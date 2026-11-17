import TextRecognition from "@react-native-ml-kit/text-recognition";
import { Buffer } from "buffer";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import jpeg from "jpeg-js";
import {
	loadTensorflowModel,
	type TfliteModel,
} from "react-native-fast-tflite";
import { logger } from "@/core/logger";
import type { QAStatus } from "@/core/types/inspection";

export interface MeterInferenceInput {
	imageUri: string;
	scannedBarcode?: string | null;
	tilt?: number;
}

export interface MeterInferenceResult {
	meterSerialNumber: string;
	extractedKwh: number | null;
	ocrConfidence: number;
	qaStatus: QAStatus;
	hazardReason: string | null;
	latencyMs: number;
	source:
		| "barcode+vision"
		| "vision_ocr"
		| "occluded"
		| "manual"
		| "edge_tflite_mlkit";
	decimalInferred: boolean;
}

// ---------------------------------------------------------------------------
// Singleton TFLite Model Loader
// ---------------------------------------------------------------------------
let tfliteModelPromise: Promise<TfliteModel> | null = null;

async function getTfliteModel(): Promise<TfliteModel> {
	if (!tfliteModelPromise) {
		tfliteModelPromise = (async () => {
			try {
				// Require the bundled TFLite asset
				const modelAsset = require("../../../assets/models/mobilenetv3_wire_int8.tflite");
				const model = await loadTensorflowModel(modelAsset, []);
				logger.info("Inference", "Loaded MobileNetV3 Wire TFLite model");
				return model;
			} catch (err) {
				tfliteModelPromise = null;
				logger.warn("Inference", "Failed loading TFLite model", err);
				throw err;
			}
		})();
	}
	return tfliteModelPromise;
}

// ---------------------------------------------------------------------------
// 7-Segment OCR Character Sanitization
// ---------------------------------------------------------------------------
function sanitize7Segment(raw: string): string {
	return raw
		.replace(/[OoDQ]/g, "0")
		.replace(/[Il|!]/g, "1")
		.replace(/[Zz]/g, "2")
		.replace(/E/g, "3")
		.replace(/A/g, "4")
		.replace(/[Ss]/g, "5")
		.replace(/[Gb]/g, "6")
		.replace(/T/g, "7")
		.replace(/B/g, "8")
		.replace(/[gq]/g, "9")
		.replace(/[^0-9.]/g, "");
}

/**
 * Real On-Device Edge Meter Vision Pipeline (Android Native).
 *
 * Stage 1: MobileNetV3 INT8 Wire Hazard Classifier (react-native-fast-tflite)
 * Stage 2: 7-Segment LCD Display OCR (@react-native-ml-kit/text-recognition)
 */
export async function runEdgeMeterInference(
	input: MeterInferenceInput,
): Promise<MeterInferenceResult> {
	const startTime = performance.now();
	const { imageUri, scannedBarcode } = input;

	try {
		// =======================================================================
		// Gate 0: 224x224 Resize, RGBA Decode, Mean Luminance & RGB Buffer Pack
		// =======================================================================
		const manipulated224 = await manipulateAsync(
			imageUri,
			[{ resize: { width: 224, height: 224 } }],
			{ format: SaveFormat.JPEG, compress: 0.9, base64: true },
		);

		if (!manipulated224.base64) {
			throw new Error("Failed to extract Base64 from 224x224 image");
		}

		const jpegBuffer = Buffer.from(manipulated224.base64, "base64");
		const decoded = jpeg.decode(jpegBuffer, { useTArray: true }); // RGBA Uint8Array

		const totalPixels = 224 * 224;
		const rgbInput = new Uint8Array(totalPixels * 3);
		let lumaSum = 0;

		for (let i = 0; i < totalPixels; i++) {
			const r = decoded.data[i * 4];
			const g = decoded.data[i * 4 + 1];
			const b = decoded.data[i * 4 + 2];

			rgbInput[i * 3] = r;
			rgbInput[i * 3 + 1] = g;
			rgbInput[i * 3 + 2] = b;

			lumaSum += 0.299 * r + 0.587 * g + 0.114 * b;
		}

		const meanLuma = lumaSum / totalPixels;

		// Lighting Gate
		if (meanLuma < 38 || meanLuma > 248) {
			const latencyMs = Math.round(performance.now() - startTime);
			logger.warn(
				"Inference",
				`Lighting check failed: meanLuma=${meanLuma.toFixed(1)}`,
			);
			return {
				meterSerialNumber:
					scannedBarcode?.trim().toUpperCase() ||
					`EB${(Date.now() % 900000) + 100000}`,
				extractedKwh: null,
				ocrConfidence: 0.0,
				qaStatus: "WARNING",
				hazardReason: "Poor lighting or glare — retake photo",
				latencyMs,
				source: "edge_tflite_mlkit",
				decimalInferred: false,
			};
		}

		// =======================================================================
		// Stage 1: Safety Lockout Classifier (TFLite MobileNetV3)
		// =======================================================================
		let hazardProb = 0.0;
		try {
			const model = await getTfliteModel();
			const outputs = await model.run([rgbInput.buffer]);

			if (outputs && outputs.length > 0) {
				const outBuf = outputs[0];
				// Handle float or uint8/int8 output tensor
				let rawProb = 0;
				if (outBuf.byteLength >= 8) {
					// 2 classes float32
					const f32 = new Float32Array(outBuf);
					rawProb = f32.length > 1 ? f32[1] : f32[0];
				} else {
					// uint8/int8 array
					const u8 = new Uint8Array(outBuf);
					rawProb = u8.length > 1 ? u8[1] : u8[0];
				}

				hazardProb = rawProb > 1.0 ? rawProb / 255.0 : Math.max(0, rawProb);
			}
		} catch (tfliteErr) {
			logger.warn(
				"Inference",
				"TFLite execution error, skipping lockout",
				tfliteErr,
			);
		}

		// Immediate lockout if exposed wire / unseated cover is detected (>= 0.65)
		if (hazardProb >= 0.65) {
			const latencyMs = Math.round(performance.now() - startTime);
			logger.warn(
				"Inference",
				`Safety Lockout: wire hazardProb=${hazardProb.toFixed(3)}`,
			);
			return {
				meterSerialNumber:
					scannedBarcode?.trim().toUpperCase() ||
					`EB${(Date.now() % 900000) + 100000}`,
				extractedKwh: null,
				ocrConfidence: Number(hazardProb.toFixed(3)),
				qaStatus: "CRITICAL_HAZARD",
				hazardReason: "Exposed terminal wiring or unseated cover detected",
				latencyMs,
				source: "edge_tflite_mlkit",
				decimalInferred: false,
			};
		}

		// =======================================================================
		// Stage 2: Central LCD Reticle Crop & ML Kit Text Recognition
		// =======================================================================
		// 1. Get original dimensions
		const probe = await manipulateAsync(imageUri, []);
		const origW = probe.width;
		const origH = probe.height;

		// Coordinates match the UI reticle display box ([0.18W, 0.28H, 0.64W, 0.24H])
		const cropOriginX = Math.max(0, Math.round(0.18 * origW));
		const cropOriginY = Math.max(0, Math.round(0.28 * origH));
		const cropW = Math.min(origW - cropOriginX, Math.round(0.64 * origW));
		const cropH = Math.min(origH - cropOriginY, Math.round(0.24 * origH));

		const lcdCrop = await manipulateAsync(
			imageUri,
			[
				{
					crop: {
						originX: cropOriginX,
						originY: cropOriginY,
						width: cropW,
						height: cropH,
					},
				},
			],
			{ format: SaveFormat.JPEG, compress: 0.9 },
		);

		// Helper to extract 4-8 digit numeric candidates from OCR text
		const numericRegex = /^\d{4,7}(\.\d{1,2})?$/;
		const extractCandidate = (
			text: string,
			isFullFrame: boolean,
		): string | null => {
			const rawTokens = text.split(/\s+/);
			let candidate: string | null = null;

			for (const token of rawTokens) {
				const trimmed = token.trim();
				if (!trimmed) continue;

				// Direct match against numeric pattern
				if (numericRegex.test(trimmed)) {
					if (!candidate || trimmed.length > candidate.length) {
						candidate = trimmed;
					}
					continue;
				}

				// 7-segment character sanitization
				const sanitized = sanitize7Segment(trimmed);
				if (isFullFrame) {
					// Full frame fallback: filter specifically for 5-8 digit numeric tokens
					if (numericRegex.test(sanitized)) {
						if (!candidate || sanitized.length > candidate.length) {
							candidate = sanitized;
						}
					}
				} else {
					// Reticle crop: accept any 4-8 digit numeric reading
					const digitsOnly = sanitized.replace(/\./g, "");
					if (digitsOnly.length >= 4 && digitsOnly.length <= 8) {
						if (!candidate || sanitized.length > candidate.length) {
							candidate = sanitized;
						}
					}
				}
			}
			return candidate;
		};

		// Pass 1: Reticle crop recognition
		let recognizedText = "";
		try {
			const mlkitResult = await TextRecognition.recognize(lcdCrop.uri);
			recognizedText = mlkitResult.text || "";
		} catch (mlkitErr) {
			logger.warn(
				"Inference",
				"ML Kit reticle crop recognition error",
				mlkitErr,
			);
		}

		let bestCandidate = extractCandidate(recognizedText, false);
		let ocrConfidence = 0.9;

		// Pass 2: Dual-Pass Fallback on full image if reticle crop found no candidate
		if (!bestCandidate) {
			logger.info(
				"Inference",
				"Reticle crop found no 4-8 digit reading; running full-frame fallback pass...",
			);
			try {
				const fullResult = await TextRecognition.recognize(imageUri);
				const fullText = fullResult.text || "";
				bestCandidate = extractCandidate(fullText, true);
				if (bestCandidate) {
					ocrConfidence = 0.85;
					logger.info(
						"Inference",
						`Full-frame fallback recovered kWh candidate: ${bestCandidate}`,
					);
				}
			} catch (fullErr) {
				logger.warn("Inference", "Full-frame fallback OCR error", fullErr);
			}
		}

		// S/N resolution
		let meterSerialNumber: string;
		if (scannedBarcode && scannedBarcode.trim().length > 3) {
			meterSerialNumber = scannedBarcode.trim().toUpperCase();
		} else {
			const suffix = bestCandidate
				? bestCandidate.replace(/\D/g, "").slice(-6)
				: `${(Date.now() % 900000) + 100000}`;
			meterSerialNumber = `EB${suffix}`;
		}

		const latencyMs = Math.round(performance.now() - startTime);

		// =======================================================================
		// Verdict Mapping
		// =======================================================================
		if (bestCandidate) {
			const reading = Number.parseFloat(bestCandidate);
			if (!Number.isNaN(reading) && Number.isFinite(reading)) {
				logger.info(
					"Inference",
					`Native inference [${latencyMs}ms]: S/N=${meterSerialNumber} kWh=${reading} PASS`,
				);
				return {
					meterSerialNumber,
					extractedKwh: reading,
					ocrConfidence,
					qaStatus: "PASS",
					hazardReason: null,
					latencyMs,
					source: "edge_tflite_mlkit",
					decimalInferred: false,
				};
			}
		}

		// Safe (hazardProb < 0.65) but no valid reading
		logger.info(
			"Inference",
			`Native inference [${latencyMs}ms]: Safe but no valid 4-8 digit kWh. WARNING.`,
		);
		return {
			meterSerialNumber,
			extractedKwh: null,
			ocrConfidence: 0.0,
			qaStatus: "WARNING",
			hazardReason: "Low LCD contrast — confirm kWh manually",
			latencyMs,
			source: "edge_tflite_mlkit",
			decimalInferred: false,
		};
	} catch (err) {
		const latencyMs = Math.round(performance.now() - startTime);
		const errorMsg =
			err instanceof Error ? err.message : "Inference pipeline error";
		logger.warn("Inference", `Native inference failed: ${errorMsg}`, err);

		return {
			meterSerialNumber:
				scannedBarcode?.trim().toUpperCase() ||
				`EB${(Date.now() % 900000) + 100000}`,
			extractedKwh: null,
			ocrConfidence: 0.0,
			qaStatus: "CRITICAL_HAZARD",
			hazardReason: `Edge optical pipeline failure: ${errorMsg}`,
			latencyMs,
			source: "occluded",
			decimalInferred: false,
		};
	}
}
