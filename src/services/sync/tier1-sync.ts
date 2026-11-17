import type { SQLiteDatabase } from "expo-sqlite";
import {
	prepareTier1Batch,
	resolveTier1Batch,
	updateInspectionAuditStage,
} from "../../core/db/repository";
import { logger } from "../../core/logger";

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
		return false;
	}

	// 2. PREPARE BATCH
	const batchData = await prepareTier1Batch(db, 15);
	if (!batchData) {
		logger.info("SyncTier1", "No pending records to dispatch");
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

				const res = await fetch(`${gatewayUrl}/api/v1/inspections/batch`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(batchData.batch),
					signal: controller.signal,
				});

				clearTimeout(timeoutTimer);

				if (res.ok) {
					batchSuccess = true;
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
		return false;
	} catch (fatalErr) {
		logger.warn("SyncTier1", "Batch dispatch error", fatalErr);
		await resolveTier1Batch(db, batchData.ids, false);
		consecutiveFailures += 1;
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
): Promise<number> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 10000);
		const res = await fetch(
			`${gatewayUrl.trim().replace(/\/+$/, "")}/api/v1/inspections?limit=50`,
			{
				method: "GET",
				signal: controller.signal,
			},
		);
		clearTimeout(timer);

		if (!res.ok) return 0;
		const remoteItems = (await res.json()) as Array<{
			id: string;
			audit_stage?: string;
			vlm_kwh?: number | null;
			vlm_notes?: string | null;
		}>;

		let updatedCount = 0;
		for (const item of remoteItems) {
			if (item.id && item.audit_stage) {
				await updateInspectionAuditStage(
					db,
					item.id,
					item.audit_stage,
					item.vlm_kwh ?? null,
					item.vlm_notes ?? null,
				);
				updatedCount++;
			}
		}
		if (updatedCount > 0) {
			logger.info(
				"SyncTier1",
				`Reconciled ${updatedCount} inspection audit statuses from cloud`,
			);
		}
		return updatedCount;
	} catch (err) {
		logger.warn("SyncTier1", "Cloud audit status reconciliation skipped", err);
		return 0;
	}
}
