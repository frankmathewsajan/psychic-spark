import type { SQLiteDatabase } from "expo-sqlite";
import { logger } from "../logger";
import type {
	InspectionRecord,
	QueueMetrics,
	Tier1BatchPayload,
} from "../types/inspection";

export async function insertInspection(
	db: SQLiteDatabase,
	record: Omit<
		InspectionRecord,
		"sync_tier1_status" | "sync_tier2_status" | "created_at"
	>,
): Promise<void> {
	try {
		await db.runAsync(
			`INSERT INTO inspections (
        id, technician_id, device_id, meter_serial_number,
        latitude, longitude, timestamp_utc, qa_status,
        hazard_reason, extracted_kwh, ocr_confidence,
        image_local_path, sync_tier1_status, sync_tier2_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING');`,
			[
				record.id,
				record.technician_id,
				record.device_id,
				record.meter_serial_number,
				record.latitude,
				record.longitude,
				record.timestamp_utc,
				record.qa_status,
				record.hazard_reason,
				record.extracted_kwh,
				record.ocr_confidence,
				record.image_local_path,
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
	}>(`
    SELECT
      COUNT(CASE WHEN sync_tier1_status = 'PENDING' THEN 1 END) as pending_telemetry,
      COUNT(CASE WHEN sync_tier1_status = 'SYNCED' THEN 1 END) as synced_telemetry,
      COUNT(CASE WHEN sync_tier2_status = 'PENDING' THEN 1 END) as pending_images
    FROM inspections;
  `);

	return {
		pendingTelemetry: row?.pending_telemetry ?? 0,
		syncedTelemetry: row?.synced_telemetry ?? 0,
		pendingImages: row?.pending_images ?? 0,
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
		`SELECT * FROM inspections WHERE sync_tier1_status = 'PENDING' LIMIT ?;`,
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
