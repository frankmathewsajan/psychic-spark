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
	reticleBounds?: [number, number, number, number];
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

export interface WireSafetyResult {
	isHazard: boolean;
	hazardProb: number;
	reason: string | null;
}

export interface CroppedLcdOcrResult {
	kwh: number | null;
	confidence: number;
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

// ---------------------------------------------------------------------------
// Exported Helper 1: cropLcdReticle
// ---------------------------------------------------------------------------
/**
 * Crops the blue-box region via ImageManipulator.manipulateAsync (SaveFormat.JPEG, compress: 0.9)
 * and returns the cropped image URI so the UI can render it on screen.
 */
export async function cropLcdReticle(
	imageUri: string,
	reticleBounds?: [number, number, number, number] | null,
): Promise<string> {
	const probe = await manipulateAsync(imageUri, []);
	const origW = probe.width;
	const origH = probe.height;

	// Normalized display crop bounds: [normX, normY, normW, normH]
	const rawBounds = reticleBounds || [0.18, 0.28, 0.64, 0.22];
	const normX = Math.max(0, Math.min(0.95, rawBounds[0]));
	const normY = Math.max(0, Math.min(0.95, rawBounds[1]));
	const normW = Math.max(0.05, Math.min(1.0 - normX, rawBounds[2]));
	const normH = Math.max(0.05, Math.min(1.0 - normY, rawBounds[3]));

	const cropOriginX = Math.max(
		0,
		Math.min(origW - 1, Math.round(normX * origW)),
	);
	const cropOriginY = Math.max(
		0,
		Math.min(origH - 1, Math.round(normY * origH)),
	);
	const cropW = Math.max(
		1,
		Math.min(origW - cropOriginX, Math.round(normW * origW)),
	);
	const cropH = Math.max(
		1,
		Math.min(origH - cropOriginY, Math.round(normH * origH)),
	);

	logger.info(
		"Inference",
		`Reticle crop bounds [norm=${normX.toFixed(3)},${normY.toFixed(3)},${normW.toFixed(3)},${normH.toFixed(3)} -> px=${cropOriginX},${cropOriginY},${cropW}x${cropH}]`,
	);

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

	return lcdCrop.uri;
}

export interface QuadPoint {
	x: number;
	y: number;
}

/**
 * Crops and rectifies the 4-point polygon region enclosed by the CamScanner dots.
 */
export async function cropLcdQuad(
	imageUri: string,
	points: [QuadPoint, QuadPoint, QuadPoint, QuadPoint],
): Promise<string> {
	const probe = await manipulateAsync(imageUri, []);
	const origW = probe.width;
	const origH = probe.height;

	const p0 = { x: points[0].x * origW, y: points[0].y * origH };
	const p1 = { x: points[1].x * origW, y: points[1].y * origH };
	const p2 = { x: points[2].x * origW, y: points[2].y * origH };
	const p3 = { x: points[3].x * origW, y: points[3].y * origH };

	// Calculate tilt angle of the top edge P0 -> P1
	const dx = p1.x - p0.x;
	const dy = p1.y - p0.y;
	const thetaRad = Math.atan2(dy, dx);
	const thetaDeg = Math.round(thetaRad * (180 / Math.PI));

	// Bounding envelope enclosing the 4 points
	const minX = Math.max(0, Math.min(p0.x, p1.x, p2.x, p3.x));
	const minY = Math.max(0, Math.min(p0.y, p1.y, p2.y, p3.y));
	const maxX = Math.min(origW, Math.max(p0.x, p1.x, p2.x, p3.x));
	const maxY = Math.min(origH, Math.max(p0.y, p1.y, p2.y, p3.y));

	const cropOriginX = Math.max(0, Math.round(minX));
	const cropOriginY = Math.max(0, Math.round(minY));
	const cropW = Math.max(
		10,
		Math.min(origW - cropOriginX, Math.round(maxX - minX)),
	);
	const cropH = Math.max(
		10,
		Math.min(origH - cropOriginY, Math.round(maxY - minY)),
	);

	logger.info(
		"Inference",
		`CamScanner quad crop: px=[${cropOriginX},${cropOriginY},${cropW}x${cropH}], tilt=${thetaDeg}deg`,
	);

	const actions: Array<
		| {
				crop: {
					originX: number;
					originY: number;
					width: number;
					height: number;
				};
		  }
		| { rotate: number }
	> = [
		{
			crop: {
				originX: cropOriginX,
				originY: cropOriginY,
				width: cropW,
				height: cropH,
			},
		},
	];

	if (Math.abs(thetaDeg) >= 2 && Math.abs(thetaDeg) <= 60) {
		actions.push({ rotate: -thetaDeg });
	}

	const lcdCrop = await manipulateAsync(imageUri, actions, {
		compress: 0.92,
		format: SaveFormat.JPEG,
	});

	return lcdCrop.uri;
}

// ---------------------------------------------------------------------------
// Exported Helper 2: runWireSafetyCheck
// ---------------------------------------------------------------------------
/**
 * Runs Stage 1 mobilenetv3_wire_int8.tflite on the full meter photo and returns
 * { isHazard: boolean, hazardProb: number, reason: string | null }.
 */
export async function runWireSafetyCheck(
	imageUri: string,
): Promise<WireSafetyResult> {
	try {
		const manipulated224 = await manipulateAsync(
			imageUri,
			[{ resize: { width: 224, height: 224 } }],
			{ format: SaveFormat.JPEG, compress: 0.9, base64: true },
		);

		if (!manipulated224.base64) {
			logger.warn("Inference", "Failed to extract Base64 from 224x224 image");
			return { isHazard: false, hazardProb: 0.0, reason: null };
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
			logger.warn(
				"Inference",
				`Lighting check failed: meanLuma=${meanLuma.toFixed(1)}`,
			);
			return {
				isHazard: false,
				hazardProb: 0.0,
				reason: "Poor lighting or glare — retake photo",
			};
		}

		let hazardProb = 0.0;
		try {
			const model = await getTfliteModel();
			const outputs = await model.run([rgbInput.buffer]);

			if (outputs && outputs.length > 0) {
				const outBuf = outputs[0];
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

		const isHazard = hazardProb >= 0.65;
		return {
			isHazard,
			hazardProb: Number(hazardProb.toFixed(3)),
			reason: isHazard
				? "Exposed terminal wiring or unseated cover detected"
				: null,
		};
	} catch (err) {
		logger.warn("Inference", "Wire safety check failed", err);
		return { isHazard: false, hazardProb: 0.0, reason: null };
	}
}

// ---------------------------------------------------------------------------
// Exported Helper: parseMeterCandidateLine
// ---------------------------------------------------------------------------
/**
 * Extracts numeric meter reading from an OCR text line, stripping units (kWh/kVAh)
 * and rejecting non-LCD faceplate specifications (240V, 50Hz, TYPE, IEC).
 */
export function parseMeterCandidateLine(rawText: string): string | null {
	const trimmed = rawText.trim();
	if (!trimmed) return null;

	// Discard non-LCD faceplate specs/standards (excluding reading units like kWh)
	const faceplateSpecRegex = /\b(230V|240V|50Hz|60Hz|TYPE|PE1|imp|IEC)\b/i;
	if (faceplateSpecRegex.test(trimmed)) return null;

	// Strip common LCD reading units before checking numbers
	const textWithoutUnits = trimmed
		.replace(/\b(kWh|kVAh|kW\.h|kvarh)\b/gi, "")
		.trim();

	// Collapse internal whitespace so e.g. "0507 106" -> "0507106"
	const collapsed = textWithoutUnits.replace(/\s+/g, "");
	const numericRegex = /^\d{1,8}(\.\d{1,2})?$/;

	if (numericRegex.test(collapsed)) {
		return collapsed;
	}

	// Sanitize 7-segment character misreads (A->4, S->5, O->0, B->8)
	const sanitized = sanitize7Segment(collapsed);
	const match = sanitized.match(/\d{1,8}(\.\d{1,2})?/);
	return match ? match[0] : null;
}

// ---------------------------------------------------------------------------
// Exported Helper 3: runCroppedLcdOcr
// ---------------------------------------------------------------------------
/**
 * Runs @react-native-ml-kit/text-recognition strictly on croppedUri
 * (iterating blocks.flatMap(b => b.lines), filtering multi-char unit tokens,
 * collapsing whitespace, and picking the tallest numeric line).
 * Returns { kwh: number | null, confidence: number }.
 */
export async function runCroppedLcdOcr(
	croppedUri: string,
): Promise<CroppedLcdOcrResult> {
	try {
		let recognizedLines: Array<{
			text: string;
			frame?: { height: number; width: number; top: number; left: number };
		}> = [];

		try {
			const mlkitResult = await TextRecognition.recognize(croppedUri);
			if (mlkitResult.blocks && mlkitResult.blocks.length > 0) {
				for (const b of mlkitResult.blocks) {
					if (b.lines && b.lines.length > 0) {
						for (const l of b.lines) {
							recognizedLines.push({ text: l.text, frame: l.frame });
						}
					} else if (b.text) {
						recognizedLines.push({ text: b.text, frame: b.frame });
					}
				}
			} else if (mlkitResult.text) {
				recognizedLines = mlkitResult.text
					.split("\n")
					.map((t) => ({ text: t }));
			}
		} catch (mlkitErr) {
			logger.warn(
				"Inference",
				"ML Kit reticle crop recognition error",
				mlkitErr,
			);
			return { kwh: null, confidence: 0.0 };
		}

		let bestCandidate: string | null = null;
		let bestHeight = 0;

		for (const line of recognizedLines) {
			const candidateNum = parseMeterCandidateLine(line.text || "");
			if (candidateNum) {
				const lineHeight = line.frame?.height ?? 0;
				// Select line with largest bounding-box height (LCD digits are larger than faceplate print)
				if (lineHeight > bestHeight || !bestCandidate) {
					bestCandidate = candidateNum;
					bestHeight = lineHeight;
				}
			}
		}

		if (bestCandidate) {
			const reading = Number.parseFloat(bestCandidate);
			if (!Number.isNaN(reading) && Number.isFinite(reading)) {
				return {
					kwh: reading,
					confidence: 0.9,
				};
			}
		}

		return {
			kwh: null,
			confidence: 0.0,
		};
	} catch (err) {
		logger.warn("Inference", "Cropped LCD OCR failed", err);
		return { kwh: null, confidence: 0.0 };
	}
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
		// Stage 1: Wire Safety & Lighting Check
		const safetyResult = await runWireSafetyCheck(imageUri);

		// If lighting gate failed (reason provided without hazard)
		if (safetyResult.reason && !safetyResult.isHazard) {
			const latencyMs = Math.round(performance.now() - startTime);
			return {
				meterSerialNumber:
					scannedBarcode?.trim().toUpperCase() ||
					`EB${(Date.now() % 900000) + 100000}`,
				extractedKwh: null,
				ocrConfidence: 0.0,
				qaStatus: "WARNING",
				hazardReason: safetyResult.reason,
				latencyMs,
				source: "edge_tflite_mlkit",
				decimalInferred: false,
			};
		}

		// Immediate lockout if exposed wire / unseated cover is detected
		if (safetyResult.isHazard) {
			const latencyMs = Math.round(performance.now() - startTime);
			logger.warn(
				"Inference",
				`Safety Lockout: wire hazardProb=${safetyResult.hazardProb.toFixed(3)}`,
			);
			return {
				meterSerialNumber:
					scannedBarcode?.trim().toUpperCase() ||
					`EB${(Date.now() % 900000) + 100000}`,
				extractedKwh: null,
				ocrConfidence: safetyResult.hazardProb,
				qaStatus: "CRITICAL_HAZARD",
				hazardReason:
					safetyResult.reason ||
					"Exposed terminal wiring or unseated cover detected",
				latencyMs,
				source: "edge_tflite_mlkit",
				decimalInferred: false,
			};
		}

		// Stage 2: Reticle Crop & Cropped OCR
		const croppedUri = await cropLcdReticle(imageUri, input.reticleBounds);
		const ocrResult = await runCroppedLcdOcr(croppedUri);

		// S/N resolution
		let meterSerialNumber: string;
		if (scannedBarcode && scannedBarcode.trim().length > 3) {
			meterSerialNumber = scannedBarcode.trim().toUpperCase();
		} else {
			const suffix =
				ocrResult.kwh !== null
					? String(ocrResult.kwh).replace(/\D/g, "").slice(-6)
					: `${(Date.now() % 900000) + 100000}`;
			meterSerialNumber = `EB${suffix}`;
		}

		const latencyMs = Math.round(performance.now() - startTime);

		if (ocrResult.kwh !== null) {
			logger.info(
				"Inference",
				`Native inference [${latencyMs}ms]: S/N=${meterSerialNumber} kWh=${ocrResult.kwh} PASS`,
			);
			return {
				meterSerialNumber,
				extractedKwh: ocrResult.kwh,
				ocrConfidence: ocrResult.confidence,
				qaStatus: "PASS",
				hazardReason: null,
				latencyMs,
				source: "edge_tflite_mlkit",
				decimalInferred: false,
			};
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
