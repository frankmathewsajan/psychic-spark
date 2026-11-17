export type QAStatus = "PASS" | "WARNING" | "CRITICAL_HAZARD";
export type SyncStatus = "HOLD_ML" | "PENDING" | "SYNCING" | "SYNCED";
export type InferenceStatus =
	| "PENDING_ML"
	| "PROCESSING"
	| "NEEDS_REVIEW"
	| "DONE";

export interface InspectionRecord {
	id: string;
	technician_id: string;
	device_id: string;
	device_model?: string | null;
	app_version?: string | null;
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
	inference_status: InferenceStatus;
	tilt_deg?: number;
	audit_stage?: string;
	vlm_kwh?: number | null;
	vlm_notes?: string | null;
	vlm_summary?: string | null;
	vlm_tags?: string | null;
	qc_checklist_json?: string | null;
	crop_bounds_json?: string | null;
	created_at?: string;
}

export interface Tier1BatchPayload {
	batch_id: string;
	inspections: Array<{
		id: string;
		technician_id: string;
		device_id: string;
		device_model?: string;
		app_version?: string;
		meter_serial_number: string;
		timestamp_utc: string;
		geo: [number, number];
		qa_status: QAStatus;
		hazard_reason: string | null;
		kwh_reading: number | null;
		ocr_confidence: number | null;
	}>;
}

export interface ClientMessage {
	id: string;
	target_type: string;
	target_id: string;
	message_type: string;
	priority: string;
	title: string;
	body: string;
	payload_json?: string | null;
	created_at: string;
	ack_status: "DELIVERED" | "READ" | "ACTIONED";
	received_at?: string;
}

export interface PendingAck {
	id: string;
	message_id: string;
	device_id: string;
	technician_id: string;
	status: "DELIVERED" | "READ" | "ACTIONED";
	client_notes?: string | null;
	created_at?: string;
}

export interface QueueMetrics {
	pendingTelemetry: number;
	syncedTelemetry: number;
	pendingImages: number;
	needsReview: number;
	pendingMl: number;
}
