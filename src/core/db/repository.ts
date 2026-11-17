import Constants from "expo-constants";
import * as Device from "expo-device";
import type { SQLiteDatabase } from "expo-sqlite";
import { logger } from "../logger";
import type {
	ClientMessage,
	InferenceStatus,
	InspectionRecord,
	PendingAck,
	QAStatus,
	QueueMetrics,
	SyncStatus,
	Tier1BatchPayload,
} from "../types/inspection";

export async function getOrCreateDeviceId(db: SQLiteDatabase): Promise<string> {
	const existing = await getSetting(db, "device_id", "");
	if (existing) return existing;
	const generated = `dev_${(Device.osName ?? "android").toLowerCase()}_${Math.random().toString(36).substring(2, 10)}`;
	await setSetting(db, "device_id", generated);
	return generated;
}

export function getDeviceModel(): string {
	return Device.modelName ?? Device.deviceName ?? "Android";
}

export function getAppVersion(): string {
	return Constants.expoConfig?.version ?? "1.0.0";
}

export async function insertInspection(
	db: SQLiteDatabase,
	record: Omit<
		InspectionRecord,
		"sync_tier1_status" | "sync_tier2_status" | "created_at"
	> & {
		sync_tier1_status?: SyncStatus;
		sync_tier2_status?: SyncStatus;
	},
): Promise<void> {
	try {
		const tier1 =
			record.sync_tier1_status ??
			(record.inference_status === "PENDING_ML" ? "HOLD_ML" : "PENDING");
		const tier2 = record.sync_tier2_status ?? "PENDING";
		const tilt = record.tilt_deg ?? 0.0;
		const model = record.device_model ?? getDeviceModel();
		const ver = record.app_version ?? getAppVersion();

		await db.runAsync(
			`INSERT INTO inspections (
        id, technician_id, device_id, device_model, app_version, meter_serial_number,
        latitude, longitude, timestamp_utc, qa_status,
        hazard_reason, extracted_kwh, ocr_confidence,
        image_local_path, sync_tier1_status, sync_tier2_status, inference_status, tilt_deg
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
			[
				record.id,
				record.technician_id,
				record.device_id,
				model,
				ver,
				record.meter_serial_number,
				record.latitude,
				record.longitude,
				record.timestamp_utc,
				record.qa_status,
				record.hazard_reason,
				record.extracted_kwh,
				record.ocr_confidence,
				record.image_local_path,
				tier1,
				tier2,
				record.inference_status,
				tilt,
			],
		);
		logger.info("Repository", `Committed inspection ${record.id} to SQLite`);
	} catch (err) {
		logger.error(
			"Repository",
			`Insert failed for inspection ${record.id}`,
			err,
		);
		throw err;
	}
}

export async function getQueueMetrics(
	db: SQLiteDatabase,
): Promise<QueueMetrics> {
	const row = await db.getFirstAsync<{
		pending_telemetry: number;
		synced_telemetry: number;
		pending_images: number;
		needs_review: number;
		pending_ml: number;
	}>(`
    SELECT
      COUNT(CASE WHEN sync_tier1_status = 'PENDING' AND inference_status = 'DONE' THEN 1 END) as pending_telemetry,
      COUNT(CASE WHEN sync_tier1_status = 'SYNCED' THEN 1 END) as synced_telemetry,
      COUNT(CASE WHEN sync_tier2_status = 'PENDING' THEN 1 END) as pending_images,
      COUNT(CASE WHEN inference_status = 'NEEDS_REVIEW' THEN 1 END) as needs_review,
      COUNT(CASE WHEN inference_status IN ('PENDING_ML','PROCESSING') THEN 1 END) as pending_ml
    FROM inspections;
  `);

	return {
		pendingTelemetry: row?.pending_telemetry ?? 0,
		syncedTelemetry: row?.synced_telemetry ?? 0,
		pendingImages: row?.pending_images ?? 0,
		needsReview: row?.needs_review ?? 0,
		pendingMl: row?.pending_ml ?? 0,
	};
}

export async function getInspections(
	db: SQLiteDatabase,
	query = "",
): Promise<InspectionRecord[]> {
	if (query.trim()) {
		return await db.getAllAsync<InspectionRecord>(
			`SELECT * FROM inspections WHERE meter_serial_number LIKE ? ORDER BY created_at DESC LIMIT 50;`,
			[`%${query}%`],
		);
	}
	return await db.getAllAsync<InspectionRecord>(
		`SELECT * FROM inspections ORDER BY created_at DESC LIMIT 50;`,
	);
}

export async function prepareTier1Batch(
	db: SQLiteDatabase,
	batchLimit = 15,
): Promise<{ batch: Tier1BatchPayload; ids: string[] } | null> {
	const rows = await db.getAllAsync<InspectionRecord>(
		`SELECT * FROM inspections WHERE sync_tier1_status = 'PENDING' AND inference_status = 'DONE' LIMIT ?;`,
		[batchLimit],
	);

	if (rows.length === 0) return null;

	const ids = rows.map((r) => r.id);
	const placeholders = ids.map(() => "?").join(",");

	await db.runAsync(
		`UPDATE inspections SET sync_tier1_status = 'SYNCING' WHERE id IN (${placeholders});`,
		ids,
	);

	return {
		ids,
		batch: {
			batch_id: `batch_${Date.now()}`,
			inspections: rows.map((r) => ({
				id: r.id,
				technician_id: r.technician_id,
				device_id: r.device_id,
				device_model: r.device_model ?? getDeviceModel(),
				app_version: r.app_version ?? getAppVersion(),
				meter_serial_number: r.meter_serial_number,
				timestamp_utc: r.timestamp_utc,
				geo: [r.latitude, r.longitude],
				qa_status: r.qa_status,
				hazard_reason: r.hazard_reason,
				kwh_reading: r.extracted_kwh,
				ocr_confidence: r.ocr_confidence,
			})),
		},
	};
}

export async function resolveTier1Batch(
	db: SQLiteDatabase,
	ids: string[],
	success: boolean,
): Promise<void> {
	if (ids.length === 0) return;

	const placeholders = ids.map(() => "?").join(",");
	const newStatus = success ? "SYNCED" : "PENDING";
	await db.runAsync(
		`UPDATE inspections SET sync_tier1_status = '${newStatus}' WHERE id IN (${placeholders});`,
		ids,
	);
}

/**
 * Atomically claim the next PENDING_ML row for background processing.
 * Returns null if none available or if another worker is already running.
 */
export async function claimNextPendingMlRow(
	db: SQLiteDatabase,
): Promise<InspectionRecord | null> {
	const row = await db.getFirstAsync<InspectionRecord>(
		`SELECT * FROM inspections WHERE inference_status = 'PENDING_ML' ORDER BY created_at ASC LIMIT 1;`,
	);
	if (!row) return null;

	await db.runAsync(
		`UPDATE inspections SET inference_status = 'PROCESSING' WHERE id = ? AND inference_status = 'PENDING_ML';`,
		[row.id],
	);
	// Confirm we won the CAS race
	const confirmed = await db.getFirstAsync<{ inference_status: string }>(
		`SELECT inference_status FROM inspections WHERE id = ?;`,
		[row.id],
	);
	if (confirmed?.inference_status !== "PROCESSING") return null;

	return row;
}

export interface MlResult {
	meterSerialNumber: string;
	extractedKwh: number | null;
	ocrConfidence: number;
	qaStatus: QAStatus;
	hazardReason: string | null;
	inferenceStatus: InferenceStatus;
}

export async function updateInspectionWithMlResult(
	db: SQLiteDatabase,
	id: string,
	result: MlResult,
): Promise<void> {
	await db.runAsync(
		`UPDATE inspections SET
      meter_serial_number = ?,
      extracted_kwh = ?,
      ocr_confidence = ?,
      qa_status = ?,
      hazard_reason = ?,
      inference_status = ?,
      sync_tier1_status = CASE WHEN ? = 'DONE' THEN 'PENDING' ELSE sync_tier1_status END
    WHERE id = ?;`,
		[
			result.meterSerialNumber,
			result.extractedKwh,
			result.ocrConfidence,
			result.qaStatus,
			result.hazardReason,
			result.inferenceStatus,
			result.inferenceStatus,
			id,
		],
	);
}

export async function getReviewQueue(
	db: SQLiteDatabase,
): Promise<InspectionRecord[]> {
	return await db.getAllAsync<InspectionRecord>(
		`SELECT * FROM inspections WHERE inference_status = 'NEEDS_REVIEW' ORDER BY created_at ASC;`,
	);
}

export async function getInspectionById(
	db: SQLiteDatabase,
	id: string,
): Promise<InspectionRecord | null> {
	return (
		(await db.getFirstAsync<InspectionRecord>(
			`SELECT * FROM inspections WHERE id = ?;`,
			[id],
		)) ?? null
	);
}

export async function commitReviewedInspection(
	db: SQLiteDatabase,
	id: string,
	data: {
		meterSerialNumber: string;
		extractedKwh: number | null;
		ocrConfidence: number;
		qaStatus: QAStatus;
		hazardReason: string | null;
	},
): Promise<void> {
	await db.runAsync(
		`UPDATE inspections SET
      meter_serial_number = ?,
      extracted_kwh = ?,
      ocr_confidence = ?,
      qa_status = ?,
      hazard_reason = ?,
      inference_status = 'DONE',
      sync_tier1_status = 'PENDING'
    WHERE id = ?;`,
		[
			data.meterSerialNumber,
			data.extractedKwh,
			data.ocrConfidence,
			data.qaStatus,
			data.hazardReason,
			id,
		],
	);
}

export async function updateInspectionAuditStage(
	db: SQLiteDatabase,
	id: string,
	auditStage: string,
	vlmKwh: number | null,
	vlmNotes: string | null,
): Promise<void> {
	await db.runAsync(
		`UPDATE inspections SET
			audit_stage = ?,
			vlm_kwh = COALESCE(?, vlm_kwh),
			vlm_notes = ?
		WHERE id = ?;`,
		[auditStage, vlmKwh, vlmNotes, id],
	);
}

export async function clearAllInspections(db: SQLiteDatabase): Promise<void> {
	await db.runAsync(`DELETE FROM inspections;`);
	logger.info("Repository", "Cleared all inspection records from SQLite");
}

export async function getSetting(
	db: SQLiteDatabase,
	key: string,
	defaultValue: string,
): Promise<string> {
	const row = await db.getFirstAsync<{ value: string }>(
		`SELECT value FROM app_settings WHERE key = ?;`,
		[key],
	);
	return row?.value ?? defaultValue;
}

export async function setSetting(
	db: SQLiteDatabase,
	key: string,
	value: string,
): Promise<void> {
	await db.runAsync(
		`INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
		[key, value],
	);
	logger.info("Repository", `Saved setting ${key} = ${value}`);
}

// ---------------------------------------------------------------------------
// 2-Way Client Messaging & Guaranteed ACK Helpers
// ---------------------------------------------------------------------------

export async function upsertClientMessage(
	db: SQLiteDatabase,
	msg: ClientMessage,
): Promise<void> {
	await db.runAsync(
		`INSERT INTO client_messages (
			id, target_type, target_id, message_type, priority, title, body, payload_json, created_at, ack_status
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			title = excluded.title,
			body = excluded.body,
			priority = excluded.priority;`,
		[
			msg.id,
			msg.target_type,
			msg.target_id,
			msg.message_type,
			msg.priority,
			msg.title,
			msg.body,
			msg.payload_json ?? null,
			msg.created_at,
			msg.ack_status ?? "DELIVERED",
		],
	);
}

export async function getActiveClientMessages(
	db: SQLiteDatabase,
): Promise<ClientMessage[]> {
	return await db.getAllAsync<ClientMessage>(
		`SELECT * FROM client_messages WHERE ack_status != 'ACTIONED' ORDER BY created_at DESC;`,
	);
}

export async function recordClientAck(
	db: SQLiteDatabase,
	messageId: string,
	deviceId: string,
	technicianId: string,
	status: "DELIVERED" | "READ" | "ACTIONED",
	clientNotes?: string,
): Promise<void> {
	// 1. Update local client message status
	await db.runAsync(`UPDATE client_messages SET ack_status = ? WHERE id = ?;`, [
		status,
		messageId,
	]);

	// 2. Queue in pending_message_acks for server synchronization
	const ackId = `ack_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
	await db.runAsync(
		`INSERT INTO pending_message_acks (id, message_id, device_id, technician_id, status, client_notes)
		VALUES (?, ?, ?, ?, ?, ?);`,
		[ackId, messageId, deviceId, technicianId, status, clientNotes ?? null],
	);
}

export async function getPendingMessageAcks(
	db: SQLiteDatabase,
): Promise<PendingAck[]> {
	return await db.getAllAsync<PendingAck>(
		`SELECT * FROM pending_message_acks ORDER BY created_at ASC;`,
	);
}

export async function removePendingMessageAck(
	db: SQLiteDatabase,
	ackId: string,
): Promise<void> {
	await db.runAsync(`DELETE FROM pending_message_acks WHERE id = ?;`, [ackId]);
}
