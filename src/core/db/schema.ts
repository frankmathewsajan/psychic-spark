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
    sync_tier1_status TEXT DEFAULT 'PENDING',
    sync_tier2_status TEXT DEFAULT 'PENDING',
    inference_status TEXT CHECK(inference_status IN ('PENDING_ML','PROCESSING','NEEDS_REVIEW','DONE')) DEFAULT 'DONE',
    tilt_deg REAL DEFAULT 0.0,
    audit_stage TEXT DEFAULT 'IMAGE_RECEIVED',
    vlm_kwh REAL,
    vlm_notes TEXT,
    vlm_summary TEXT,
    vlm_tags TEXT,
    qc_checklist_json TEXT,
    crop_bounds_json TEXT,
    evidence_sha256 TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inspections_tier1 ON inspections(sync_tier1_status);
CREATE INDEX IF NOT EXISTS idx_inspections_tier2 ON inspections(sync_tier2_status);
CREATE INDEX IF NOT EXISTS idx_inspections_ml ON inspections(inference_status);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS client_messages (
    id TEXT PRIMARY KEY NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    message_type TEXT NOT NULL,
    priority TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    payload_json TEXT,
    created_at TEXT NOT NULL,
    ack_status TEXT DEFAULT 'DELIVERED',
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pending_message_acks (
    id TEXT PRIMARY KEY NOT NULL,
    message_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    technician_id TEXT NOT NULL,
    status TEXT NOT NULL,
    client_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

export async function runDatabaseInit(db: SQLiteDatabase): Promise<void> {
	try {
		await db.execAsync(DDL_SCHEMA);

		// LIVE MIGRATION 0: Ensure app_settings table exists
		try {
			await db.runAsync(
				`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`,
			);
		} catch {
			// Already exists
		}

		// LIVE MIGRATION 0b: Ensure messaging tables exist
		try {
			await db.runAsync(`
				CREATE TABLE IF NOT EXISTS client_messages (
					id TEXT PRIMARY KEY NOT NULL,
					target_type TEXT NOT NULL,
					target_id TEXT NOT NULL,
					message_type TEXT NOT NULL,
					priority TEXT NOT NULL,
					title TEXT NOT NULL,
					body TEXT NOT NULL,
					payload_json TEXT,
					created_at TEXT NOT NULL,
					ack_status TEXT DEFAULT 'DELIVERED',
					received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				);
			`);
			await db.runAsync(`
				CREATE TABLE IF NOT EXISTS pending_message_acks (
					id TEXT PRIMARY KEY NOT NULL,
					message_id TEXT NOT NULL,
					device_id TEXT NOT NULL,
					technician_id TEXT NOT NULL,
					status TEXT NOT NULL,
					client_notes TEXT,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				);
			`);
		} catch {
			// Already exists
		}

		// LIVE MIGRATION 0c: Add device attribution columns
		try {
			await db.runAsync(
				`ALTER TABLE inspections ADD COLUMN device_model TEXT;`,
			);
		} catch {}
		try {
			await db.runAsync(`ALTER TABLE inspections ADD COLUMN app_version TEXT;`);
		} catch {}

		// LIVE MIGRATION 1: Add inference_status column if missing
		try {
			await db.runAsync(
				`ALTER TABLE inspections ADD COLUMN inference_status TEXT CHECK(inference_status IN ('PENDING_ML','PROCESSING','NEEDS_REVIEW','DONE')) DEFAULT 'DONE';`,
			);
		} catch {
			// Column exists
		}

		// LIVE MIGRATION 2: Add tilt_deg column if missing
		try {
			await db.runAsync(
				`ALTER TABLE inspections ADD COLUMN tilt_deg REAL DEFAULT 0.0;`,
			);
		} catch {
			// Column exists
		}

		// LIVE MIGRATION 2b: Add VLM audit columns if missing
		try {
			await db.runAsync(
				`ALTER TABLE inspections ADD COLUMN audit_stage TEXT DEFAULT 'IMAGE_RECEIVED';`,
			);
		} catch {}
		try {
			await db.runAsync(`ALTER TABLE inspections ADD COLUMN vlm_kwh REAL;`);
		} catch {}
		try {
			await db.runAsync(`ALTER TABLE inspections ADD COLUMN vlm_notes TEXT;`);
		} catch {}
		try {
			await db.runAsync(`ALTER TABLE inspections ADD COLUMN vlm_summary TEXT;`);
		} catch {}
		try {
			await db.runAsync(`ALTER TABLE inspections ADD COLUMN vlm_tags TEXT;`);
		} catch {}
		try {
			await db.runAsync(
				`ALTER TABLE inspections ADD COLUMN qc_checklist_json TEXT;`,
			);
		} catch {}
		try {
			await db.runAsync(
				`ALTER TABLE inspections ADD COLUMN crop_bounds_json TEXT;`,
			);
		} catch {}
		// LIVE MIGRATION 2c: Add evidence_sha256 column if missing
		try {
			await db.runAsync(
				`ALTER TABLE inspections ADD COLUMN evidence_sha256 TEXT;`,
			);
		} catch {}

		// LIVE MIGRATION 3: Check if sync_tier1_status has a restrictive CHECK constraint that blocks 'HOLD_ML'
		// In SQLite, old tables with CHECK(sync_tier1_status IN ('PENDING', 'SYNCING', 'SYNCED')) will reject 'HOLD_ML'.
		// We detect this by attempting a test transaction that we immediately rollback, or migrating if needed.
		try {
			await db.execAsync(`
				BEGIN TRANSACTION;
				INSERT INTO inspections (
					id, technician_id, device_id, meter_serial_number,
					latitude, longitude, timestamp_utc, qa_status,
					image_local_path, sync_tier1_status, sync_tier2_status, inference_status
				) VALUES (
					'__migration_test__', 'test', 'test', 'test',
					0, 0, '2026-01-01', 'PASS',
					'test', 'HOLD_ML', 'PENDING', 'PENDING_ML'
				);
				ROLLBACK;
			`);
		} catch {
			// CHECK constraint failed! Migrate table to remove rigid CHECK on sync statuses
			logger.info(
				"DB",
				"Migrating inspections table to loosen sync_tier1_status CHECK constraint...",
			);
			await db.execAsync(`
				PRAGMA foreign_keys = OFF;
				BEGIN TRANSACTION;

				CREATE TABLE inspections_new (
					id TEXT PRIMARY KEY NOT NULL,
					technician_id TEXT NOT NULL,
					device_id TEXT NOT NULL,
					device_model TEXT,
					app_version TEXT,
					meter_serial_number TEXT NOT NULL,
					latitude REAL NOT NULL,
					longitude REAL NOT NULL,
					timestamp_utc TEXT NOT NULL,
					qa_status TEXT CHECK(qa_status IN ('PASS', 'WARNING', 'CRITICAL_HAZARD')) NOT NULL,
					hazard_reason TEXT,
					extracted_kwh REAL,
					ocr_confidence REAL,
					image_local_path TEXT NOT NULL,
					sync_tier1_status TEXT DEFAULT 'PENDING',
					sync_tier2_status TEXT DEFAULT 'PENDING',
					inference_status TEXT CHECK(inference_status IN ('PENDING_ML','PROCESSING','NEEDS_REVIEW','DONE')) DEFAULT 'DONE',
					tilt_deg REAL DEFAULT 0.0,
					audit_stage TEXT DEFAULT 'IMAGE_RECEIVED',
					vlm_kwh REAL,
					vlm_notes TEXT,
					vlm_summary TEXT,
					vlm_tags TEXT,
					qc_checklist_json TEXT,
					crop_bounds_json TEXT,
					evidence_sha256 TEXT,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				);

				INSERT INTO inspections_new (
					id, technician_id, device_id, meter_serial_number,
					latitude, longitude, timestamp_utc, qa_status,
					hazard_reason, extracted_kwh, ocr_confidence,
					image_local_path, sync_tier1_status, sync_tier2_status,
					inference_status, created_at
				)
				SELECT 
					id, technician_id, device_id, meter_serial_number,
					latitude, longitude, timestamp_utc, qa_status,
					hazard_reason, extracted_kwh, ocr_confidence,
					image_local_path, sync_tier1_status, sync_tier2_status,
					COALESCE(inference_status, 'DONE'), created_at
				FROM inspections;

				DROP TABLE inspections;
				ALTER TABLE inspections_new RENAME TO inspections;

				CREATE INDEX IF NOT EXISTS idx_inspections_tier1 ON inspections(sync_tier1_status);
				CREATE INDEX IF NOT EXISTS idx_inspections_tier2 ON inspections(sync_tier2_status);
				CREATE INDEX IF NOT EXISTS idx_inspections_ml ON inspections(inference_status);

				COMMIT;
				PRAGMA foreign_keys = ON;
			`);
			logger.info(
				"DB",
				"inspections table successfully migrated without strict CHECK constraint",
			);
		}

		// LIVE MIGRATION POST-CHECK: Guarantee all columns exist even on migrated or restored instances
		const postCheckColumns = [
			"device_model TEXT",
			"app_version TEXT",
			"audit_stage TEXT DEFAULT 'IMAGE_RECEIVED'",
			"vlm_kwh REAL",
			"vlm_notes TEXT",
			"vlm_summary TEXT",
			"vlm_tags TEXT",
			"qc_checklist_json TEXT",
			"crop_bounds_json TEXT",
			"evidence_sha256 TEXT",
		];
		for (const colDef of postCheckColumns) {
			try {
				await db.runAsync(`ALTER TABLE inspections ADD COLUMN ${colDef};`);
			} catch {
				// Column already exists
			}
		}

		// CRASH RECOVERY: Reset uncommitted rows left in SYNCING state
		await db.runAsync(
			`UPDATE inspections SET sync_tier1_status = 'PENDING' WHERE sync_tier1_status = 'SYNCING';`,
		);
		// CRASH RECOVERY: Any row stuck mid-processing was interrupted — re-queue it
		await db.runAsync(
			`UPDATE inspections SET inference_status = 'PENDING_ML' WHERE inference_status = 'PROCESSING';`,
		);

		logger.info(
			"DB",
			"Schema initialized & orphan recovery executed successfully",
		);
	} catch (error) {
		logger.error("DB", "Failed executing database bootstrap schema", error);
		throw error;
	}
}
