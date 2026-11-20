import type { SQLiteDatabase } from "expo-sqlite";
import {
	getPendingMessageAcks,
	prepareTier1Batch,
	recordClientAck,
	removePendingMessageAck,
	resolveTier1Batch,
	restoreInspectionFromCloud,
	updateInspectionAuditStage,
	upsertClientMessage,
} from "../../core/db/repository";
import { logger } from "../../core/logger";
import type { ClientMessage } from "../../core/types/inspection";

export interface Tier1MetadataProgress {
	stage: "PREPARING" | "UPLOADING" | "SYNCED" | "EMPTY" | "ERROR";
	recordCount: number;
	attempt?: number;
	maxAttempts?: number;
	error?: string;
}

export interface Tier1SyncOptions {
	maxRetries?: number;
	initialDelayMs?: number;
	maxDelayMs?: number;
	backoffFactor?: number;
	timeoutMs?: number;
	force?: boolean;
	onPingAttempt?: (attempt: number, maxAttempts: number) => void;
	onProgress?: (progress: {
		attempt: number;
		maxAttempts: number;
		delayMs?: number;
		error?: string;
	}) => void;
	onMetadataProgress?: (progress: Tier1MetadataProgress) => void;
}

export interface Tier1BackoffState {
	consecutiveFailures: number;
	inCooldown: boolean;
	cooldownSecondsRemaining: number;
	isSyncing: boolean;
	lastError: string | null;
}

let consecutiveFailures = 0;
let cooldownUntilTimestamp = 0;
let isSyncing = false;
let lastError: string | null = null;

export function getTier1BackoffInfo(): Tier1BackoffState {
	const now = Date.now();
	const remainingMs = Math.max(0, cooldownUntilTimestamp - now);
	return {
		consecutiveFailures,
		inCooldown: remainingMs > 0,
		cooldownSecondsRemaining: Math.ceil(remainingMs / 1000),
		isSyncing,
		lastError,
	};
}

export function resetTier1Backoff(): void {
	consecutiveFailures = 0;
	cooldownUntilTimestamp = 0;
	lastError = null;
}

function calculateDelay(
	attempt: number,
	initialDelayMs: number,
	maxDelayMs: number,
	factor: number,
): number {
	const base = initialDelayMs * factor ** attempt;
	const jitter = Math.random() * 300;
	return Math.min(maxDelayMs, Math.round(base + jitter));
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pings the gateway health endpoint with exponential backoff (up to 3 retries).
 * Notifies caller of each attempt via onAttempt callback.
 */
export async function pingGateway(
	gatewayUrl: string,
	maxRetries = 4,
	timeoutMs = 15000,
	onAttempt?: (attempt: number, maxAttempts: number) => void,
): Promise<{ ok: boolean; error?: string }> {
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		onAttempt?.(attempt + 1, maxRetries);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const res = await fetch(`${gatewayUrl}/api/v1/health`, {
				method: "GET",
				signal: controller.signal,
			});
			clearTimeout(timer);
			if (res.ok) {
				return { ok: true };
			}
		} catch {
			clearTimeout(timer);
		}

		if (attempt < maxRetries - 1) {
			const delay = calculateDelay(attempt, 800, 4000, 2);
			await sleep(delay);
		}
	}

	return { ok: false, error: "Server not reachable" };
}

export async function executeTier1Sync(
	db: SQLiteDatabase,
	gatewayUrl: string,
	options: Tier1SyncOptions = {},
): Promise<boolean> {
	const {
		maxRetries = 3,
		initialDelayMs = 1000,
		maxDelayMs = 8000,
		backoffFactor = 2,
		timeoutMs = 5000,
		force = false,
		onPingAttempt,
		onProgress,
		onMetadataProgress,
	} = options;

	const now = Date.now();
	if (!force && cooldownUntilTimestamp > now) {
		const remainingSec = Math.ceil((cooldownUntilTimestamp - now) / 1000);
		logger.info(
			"SyncTier1",
			`In backoff cooldown for another ${remainingSec}s (${consecutiveFailures} failures). Skipping.`,
		);
		return false;
	}

	if (isSyncing) {
		logger.info("SyncTier1", "Sync already running.");
		return false;
	}

	// 1. PING GATEWAY WITH ATTEMPT TRACKING (cold-start tolerant)
	const ping = await pingGateway(gatewayUrl, 4, 15000, onPingAttempt);
	if (!ping.ok) {
		lastError = "Server not reachable";
		consecutiveFailures += 1;
		logger.warn(
			"SyncTier1",
			"Gateway ping failed after 3 attempts with exponential backoff.",
		);
		onMetadataProgress?.({
			stage: "ERROR",
			recordCount: 0,
			error: lastError,
		});
		return false;
	}

	// 2. PREPARE BATCH
	onMetadataProgress?.({
		stage: "PREPARING",
		recordCount: 0,
	});

	const batchData = await prepareTier1Batch(db, 15);
	if (!batchData) {
		logger.info("SyncTier1", "No pending records to dispatch");
		onMetadataProgress?.({
			stage: "EMPTY",
			recordCount: 0,
		});
		return true;
	}

	logger.info(
		"SyncTier1",
		`Dispatching batch of ${batchData.ids.length} records to ${gatewayUrl}`,
	);

	isSyncing = true;
	let batchSuccess = false;
	let currentError: string | null = null;
	const totalAttempts = maxRetries + 1;

	try {
		for (let attempt = 0; attempt < totalAttempts; attempt++) {
			const controller = new AbortController();
			const timeoutTimer = setTimeout(() => {
				controller.abort(
					new Error(`Tier-1 sync timed out after ${timeoutMs}ms`),
				);
			}, timeoutMs);

			try {
				onProgress?.({
					attempt: attempt + 1,
					maxAttempts: totalAttempts,
				});

				onMetadataProgress?.({
					stage: "UPLOADING",
					recordCount: batchData.ids.length,
					attempt: attempt + 1,
					maxAttempts: totalAttempts,
				});

				const res = await fetch(`${gatewayUrl}/api/v1/inspections/batch`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(batchData.batch),
					signal: controller.signal,
				});

				clearTimeout(timeoutTimer);

				if (res.ok) {
					batchSuccess = true;
					onMetadataProgress?.({
						stage: "SYNCED",
						recordCount: batchData.ids.length,
						attempt: attempt + 1,
						maxAttempts: totalAttempts,
					});
					break;
				}

				if (res.status >= 400 && res.status < 500) {
					currentError = `Server rejected batch with HTTP ${res.status}`;
					logger.warn("SyncTier1", currentError);
					break;
				}

				currentError = `Server returned HTTP ${res.status}`;
				logger.warn(
					"SyncTier1",
					`Attempt ${attempt + 1}/${totalAttempts} failed: ${currentError}`,
				);
			} catch (err: unknown) {
				clearTimeout(timeoutTimer);
				const errMsg =
					err instanceof Error ? err.message : "Unknown network error";
				currentError = errMsg;
				logger.warn(
					"SyncTier1",
					`Attempt ${attempt + 1}/${totalAttempts} network failure: ${errMsg}`,
				);
			}

			if (attempt < maxRetries) {
				const delayMs = calculateDelay(
					attempt,
					initialDelayMs,
					maxDelayMs,
					backoffFactor,
				);
				onProgress?.({
					attempt: attempt + 1,
					maxAttempts: totalAttempts,
					delayMs,
					error: currentError || "Connection error",
				});
				await sleep(delayMs);
			}
		}

		await resolveTier1Batch(db, batchData.ids, batchSuccess);

		if (batchSuccess) {
			consecutiveFailures = 0;
			cooldownUntilTimestamp = 0;
			lastError = null;
			return true;
		}

		consecutiveFailures += 1;
		const cooldownMs = Math.min(
			60000,
			2000 * 2 ** Math.min(consecutiveFailures, 5),
		);
		cooldownUntilTimestamp = Date.now() + cooldownMs;
		lastError = currentError;
		onMetadataProgress?.({
			stage: "ERROR",
			recordCount: batchData.ids.length,
			error: lastError || "Upload rejected by server",
		});
		return false;
	} catch (fatalErr) {
		logger.warn("SyncTier1", "Batch dispatch error", fatalErr);
		await resolveTier1Batch(db, batchData.ids, false);
		consecutiveFailures += 1;
		onMetadataProgress?.({
			stage: "ERROR",
			recordCount: batchData.ids.length,
			error:
				fatalErr instanceof Error ? fatalErr.message : "Fatal dispatch error",
		});
		return false;
	} finally {
		isSyncing = false;
	}
}

/**
 * Pulls recent inspection records from the gateway to synchronize
 * Cloud VLM audit stage, reconciled kWh, and diagnostic notes into local SQLite.
 */
export async function reconcileCloudAuditStatus(
	db: SQLiteDatabase,
	gatewayUrl: string,
	deviceId?: string,
): Promise<number> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 10000);
		const base = gatewayUrl.trim().replace(/\/+$/, "");
		const url = deviceId
			? `${base}/api/v1/devices/${encodeURIComponent(deviceId)}/restore`
			: `${base}/api/v1/inspections?limit=50`;

		const res = await fetch(url, {
			method: "GET",
			signal: controller.signal,
		});
		clearTimeout(timer);

		if (!res.ok) return 0;
		const remoteItems = (await res.json()) as Array<{
			id: string;
			technician_id?: string;
			device_id?: string;
			meter_serial_number?: string;
			latitude?: number;
			longitude?: number;
			timestamp_utc?: string;
			qa_status?: string;
			hazard_reason?: string | null;
			kwh_reading?: number | null;
			extracted_kwh?: number | null;
			ocr_confidence?: number | null;
			audit_stage?: string;
			vlm_kwh?: number | null;
			vlm_notes?: string | null;
			vlm_summary?: string | null;
			vlm_tags?: string | null;
			qc_checklist_json?: string | null;
			photos?: Array<{ photo_type: string; file_path: string }>;
		}>;

		let updatedCount = 0;
		for (const item of remoteItems) {
			if (!item.id) continue;

			const local = await db.getFirstAsync<{
				id: string;
				image_local_path: string | null;
			}>("SELECT id, image_local_path FROM inspections WHERE id = ? LIMIT 1;", [
				item.id,
			]);

			let imageUrl: string | null = null;
			if (item.photos && item.photos.length > 0 && item.photos[0].file_path) {
				const p = item.photos[0].file_path;
				imageUrl = p.startsWith("http")
					? p
					: `${base}${p.startsWith("/") ? "" : "/"}${p}`;
			}

			if (!local) {
				const restored = await restoreInspectionFromCloud(db, {
					...item,
					kwh_reading: item.kwh_reading ?? item.extracted_kwh ?? null,
					image_url: imageUrl,
				});
				if (restored) updatedCount++;
			} else {
				if (item.audit_stage) {
					await updateInspectionAuditStage(
						db,
						item.id,
						item.audit_stage,
						item.vlm_kwh ?? null,
						item.vlm_notes ?? null,
						item.vlm_summary ?? null,
						item.vlm_tags ?? null,
						item.qc_checklist_json ?? null,
					);
				}
				if (!local.image_local_path && imageUrl) {
					await db.runAsync(
						"UPDATE inspections SET image_local_path = ? WHERE id = ?;",
						[imageUrl, item.id],
					);
				}
				updatedCount++;
			}
		}
		if (updatedCount > 0) {
			logger.info(
				"SyncTier1",
				`Reconciled/Restored ${updatedCount} inspection records from cloud`,
			);
		}
		return updatedCount;
	} catch (err) {
		logger.warn("SyncTier1", "Cloud audit status reconciliation skipped", err);
		return 0;
	}
}

/**
 * Flushes all locally queued message ACKs to the cloud gateway.
 */
export async function syncPendingMessageAcks(
	db: SQLiteDatabase,
	gatewayUrl: string,
): Promise<number> {
	try {
		const pending = await getPendingMessageAcks(db);
		if (pending.length === 0) return 0;

		let flushedCount = 0;
		const base = gatewayUrl.trim().replace(/\/+$/, "");

		for (const ack of pending) {
			try {
				const res = await fetch(
					`${base}/api/v1/devices/${ack.device_id}/messages/${ack.message_id}/ack`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							technician_id: ack.technician_id,
							status: ack.status,
							client_notes: ack.client_notes ?? null,
						}),
					},
				);
				if (res.ok) {
					await removePendingMessageAck(db, ack.id);
					flushedCount++;
				}
			} catch (ackErr) {
				logger.warn("SyncTier1", `Failed to flush ack ${ack.id}`, ackErr);
			}
		}
		return flushedCount;
	} catch (err) {
		logger.warn("SyncTier1", "Error checking pending message acks", err);
		return 0;
	}
}

/**
 * Polls unread admin messages/alerts for this device and technician,
 * saves them to local SQLite, and dispatches DELIVERED ACKs.
 */
export async function syncClientMessages(
	db: SQLiteDatabase,
	gatewayUrl: string,
	deviceId: string,
	technicianId: string,
): Promise<number> {
	try {
		// 1. Flush any queued offline ACKs first
		await syncPendingMessageAcks(db, gatewayUrl);

		// 2. Fetch active messages targeted to ALL or this device/tech
		const base = gatewayUrl.trim().replace(/\/+$/, "");
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 8000);

		const res = await fetch(
			`${base}/api/v1/devices/${deviceId}/messages?technician_id=${encodeURIComponent(technicianId)}`,
			{
				method: "GET",
				signal: controller.signal,
			},
		);
		clearTimeout(timer);

		if (!res.ok) return 0;
		const messages = (await res.json()) as ClientMessage[];

		let newCount = 0;
		for (const msg of messages) {
			await upsertClientMessage(db, msg);
			if (msg.message_type === "SYNC_BACK") {
				await reconcileCloudAuditStatus(db, gatewayUrl, deviceId);
			}
			// Submit immediate DELIVERED ack
			try {
				await fetch(
					`${base}/api/v1/devices/${deviceId}/messages/${msg.id}/ack`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							technician_id: technicianId,
							status: "DELIVERED",
						}),
					},
				);
			} catch {
				// If offline/interrupted, record in pending_message_acks for next retry
				await recordClientAck(db, msg.id, deviceId, technicianId, "DELIVERED");
			}
			newCount++;
		}
		return newCount;
	} catch (err) {
		logger.warn("SyncTier1", "Message synchronization skipped", err);
		return 0;
	}
}
