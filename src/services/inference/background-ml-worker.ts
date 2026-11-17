import type { SQLiteDatabase } from "expo-sqlite";
import { useEffect, useRef } from "react";
import {
	claimNextPendingMlRow,
	updateInspectionWithMlResult,
} from "@/core/db/repository";
import { logger } from "@/core/logger";
import { runEdgeMeterInference } from "./meter-inference";

const POLL_INTERVAL_MS = 1500;

type UnreadableCaptureListener = (inspectionId: string, reason: string) => void;
const unreadableListeners = new Set<UnreadableCaptureListener>();

export function subscribeUnreadableCapture(
	listener: UnreadableCaptureListener,
): () => void {
	unreadableListeners.add(listener);
	return () => {
		unreadableListeners.delete(listener);
	};
}

function notifyUnreadable(inspectionId: string, reason: string) {
	for (const listener of unreadableListeners) {
		try {
			listener(inspectionId, reason);
		} catch (e) {
			logger.warn("BackgroundML", "Error notifying unreadable listener", e);
		}
	}
}

/**
 * Background ML Worker hook.
 *
 * Mounts in _layout.tsx alongside the ONNX WebView singleton.
 * Polls SQLite every 1500ms for PENDING_ML rows and drains them
 * one at a time through the warm ONNX engine — keeping inference
 * strictly serialized since OnnxBridge is not concurrency-safe.
 */
export function useBackgroundMlWorker(db: SQLiteDatabase | null): void {
	const processingRef = useRef(false);

	useEffect(() => {
		if (!db) return;
		const activeDb = db;

		async function processNext(): Promise<void> {
			// Enforce one-at-a-time — avoid overlapping inference tasks
			if (processingRef.current) return;

			const row = await claimNextPendingMlRow(activeDb);
			if (!row) return;

			processingRef.current = true;
			logger.info(
				"BackgroundML",
				`Processing row ${row.id} (${row.meter_serial_number || "unknown"})`,
			);

			try {
				// Don't discard real non-EB barcodes; only treat empty or UNKNOWN_ as unscanned
				const hasScannedBarcode =
					Boolean(row.meter_serial_number) &&
					!row.meter_serial_number.startsWith("UNKNOWN_");

				const result = await runEdgeMeterInference({
					imageUri: row.image_local_path,
					scannedBarcode: hasScannedBarcode ? row.meter_serial_number : null,
					tilt: row.tilt_deg ?? 0,
				});

				// PASS with no decimal guess → auto-promote to sync queue
				// Everything else → NEEDS_REVIEW for technician confirmation
				const inferenceStatus =
					result.qaStatus === "PASS" && !result.decimalInferred
						? "DONE"
						: "NEEDS_REVIEW";

				await updateInspectionWithMlResult(activeDb, row.id, {
					meterSerialNumber: result.meterSerialNumber,
					extractedKwh: result.extractedKwh,
					ocrConfidence: result.ocrConfidence,
					qaStatus: result.qaStatus,
					hazardReason: result.hazardReason,
					inferenceStatus,
				});

				if (result.qaStatus === "CRITICAL_HAZARD") {
					notifyUnreadable(
						row.id,
						result.hazardReason || "Illegible meter display",
					);
				}

				logger.info(
					"BackgroundML",
					`Row ${row.id} → ${inferenceStatus} (kWh=${result.extractedKwh}, conf=${(result.ocrConfidence * 100).toFixed(0)}%)`,
				);
			} catch (err) {
				logger.warn(
					"BackgroundML",
					`Row ${row.id} failed — marking NEEDS_REVIEW`,
					err,
				);
				// Mark for manual review; don't lose the capture
				try {
					await updateInspectionWithMlResult(activeDb, row.id, {
						meterSerialNumber: row.meter_serial_number || "UNKNOWN",
						extractedKwh: null,
						ocrConfidence: 0,
						qaStatus: "CRITICAL_HAZARD",
						hazardReason:
							"Background ML processing failed — enter reading manually",
						inferenceStatus: "NEEDS_REVIEW",
					});
					notifyUnreadable(
						row.id,
						"Background ML processing failed — enter reading manually",
					);
				} catch (writeErr) {
					logger.warn(
						"BackgroundML",
						`Could not update failure state for ${row.id}`,
						writeErr,
					);
				}
			} finally {
				processingRef.current = false;
			}
		}

		const intervalId = setInterval(() => {
			processNext().catch((err) =>
				logger.warn("BackgroundML", "Poll tick threw unexpectedly", err),
			);
		}, POLL_INTERVAL_MS);

		return () => clearInterval(intervalId);
	}, [db]);
}
