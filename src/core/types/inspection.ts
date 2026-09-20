export type QAStatus = "PASS" | "WARNING" | "CRITICAL_HAZARD";
export type SyncStatus = "PENDING" | "SYNCING" | "SYNCED";

export interface InspectionRecord {
	id: string;
	technician_id: string;
	device_id: string;
	meter_serial_number: string;
	latitude: number;
	longitude: number;
	timestamp_utc: string;
	qa_status: QAStatus;
	hazard_reason: string | null;
	extracted_kwh: number | null;
	ocr_confidence: number | null;
	image_local_path: string;
	sync_tier1_status: SyncStatus;
	sync_tier2_status: SyncStatus;
	created_at?: string;
}

export interface Tier1BatchPayload {
	batch_id: string;
	inspections: Array<{
		id: string;
		technician_id: string;
		meter_serial_number: string;
		timestamp_utc: string;
		geo: [number, number];
		qa_status: QAStatus;
		hazard_reason: string | null;
		kwh_reading: number | null;
		ocr_confidence: number | null;
	}>;
}

export interface QueueMetrics {
	pendingTelemetry: number;
	syncedTelemetry: number;
	pendingImages: number;
}
