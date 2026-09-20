import type { SQLiteDatabase } from "expo-sqlite";
import { logger } from "../logger";

export const DDL_SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY NOT NULL,
    technician_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    meter_serial_number TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    timestamp_utc TEXT NOT NULL,
    qa_status TEXT CHECK(qa_status IN ('PASS', 'WARNING', 'CRITICAL_HAZARD')) NOT NULL,
    hazard_reason TEXT,
    extracted_kwh REAL,
    ocr_confidence REAL,
    image_local_path TEXT NOT NULL,
    sync_tier1_status TEXT CHECK(sync_tier1_status IN ('PENDING', 'SYNCING', 'SYNCED')) DEFAULT 'PENDING',
    sync_tier2_status TEXT CHECK(sync_tier2_status IN ('PENDING', 'SYNCING', 'SYNCED')) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inspections_tier1 ON inspections(sync_tier1_status);
CREATE INDEX IF NOT EXISTS idx_inspections_tier2 ON inspections(sync_tier2_status);
`;

export async function runDatabaseInit(db: SQLiteDatabase): Promise<void> {
	try {
		await db.execAsync(DDL_SCHEMA);
		// CRASH RECOVERY: Reset uncommitted rows left in SYNCING state
		await db.runAsync(
			`UPDATE inspections SET sync_tier1_status = 'PENDING' WHERE sync_tier1_status = 'SYNCING';`,
		);
		logger.info(
			"DB",
			"Schema initialized & orphan recovery pragma executed successfully",
		);
	} catch (error) {
		logger.error("DB", "Failed executing database bootstrap schema", error);
		throw error;
	}
}
