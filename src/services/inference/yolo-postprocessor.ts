import type { QAStatus } from "@/core/types/inspection";

export interface RawBox {
	label: string;
	conf: number;
	box: [number, number, number, number]; // [x1, y1, x2, y2]
	x_center: number;
}

export interface PostProcessedResult {
	reading: string;
	digitCount: number;
	avgConfidence: number;
	decimalInferred: boolean;
	extractedKwh: number | null;
	qaStatus: QAStatus;
	hazardReason: string | null;
}

export interface PostProcessOptions {
	panelConfidence: number;
	meanLuma: number;
	absTilt: number;
}

/**
 * Removes duplicate boxes detecting the same digit at nearly the same horizontal position.
 */
export function deduplicateHorizontal(
	detections: RawBox[],
	overlapRatio = 0.5,
): RawBox[] {
	const sorted = [...detections].sort((a, b) => b.conf - a.conf);
	const kept: RawBox[] = [];

	for (const det of sorted) {
		const [x1, , x2] = det.box;
		const w = Math.max(x2 - x1, 1.0);
		let isDup = false;

		for (const k of kept) {
			const [kx1, , kx2] = k.box;
			const kw = Math.max(kx2 - kx1, 1.0);
			const inter = Math.max(0.0, Math.min(x2, kx2) - Math.max(x1, kx1));
			if (inter / Math.min(w, kw) > overlapRatio) {
				isDup = true;
				break;
			}
		}

		if (!isDup) {
			kept.push(det);
		}
	}

	return kept.sort((a, b) => a.x_center - b.x_center);
}

/**
 * Assembles digits into a reading string with strict double-decimal prevention
 * and height-ratio fallback for unprinted decimal points.
 */
export function assembleDigitsAndEvaluate(
	rawDetections: RawBox[],
	options: PostProcessOptions,
): PostProcessedResult {
	const { panelConfidence, meanLuma, absTilt } = options;
	const ordered = deduplicateHorizontal(rawDetections);

	const chars: string[] = [];
	const confs: number[] = [];
	const digitBoxes: { label: string; height: number }[] = [];
	let hasExplicitDot = false;

	for (const d of ordered) {
		const lbl = d.label.trim().toLowerCase();
		if (lbl === "." || lbl === "dot" || lbl === "decimal" || lbl === "point") {
			if (!hasExplicitDot && chars.length > 0) {
				chars.push(".");
				hasExplicitDot = true;
				confs.push(d.conf);
			}
		} else if (/^\d$/.test(lbl)) {
			chars.push(lbl);
			confs.push(d.conf);
			const [, y1, , y2] = d.box;
			digitBoxes.push({ label: lbl, height: Math.max(1, y2 - y1) });
		}
	}

	let decimalInferred = false;

	// Strict Guardrail: Height-ratio fallback runs ONLY when no explicit dot was detected
	// and at least 5 digits are present.
	if (!hasExplicitDot && digitBoxes.length >= 5) {
		// Use reference whole digits (up to first 3 digits or all except last 2)
		const refCount = Math.max(3, digitBoxes.length - 2);
		const refDigits = digitBoxes.slice(0, refCount);
		const avgH =
			refDigits.reduce((sum, d) => sum + d.height, 0) / refDigits.length;

		const r1 = digitBoxes[digitBoxes.length - 1].height / avgH;
		const r2 = digitBoxes[digitBoxes.length - 2].height / avgH;

		// Case 1: Last 2 digits are shorter fractional digits (e.g. 1046.12)
		if (r1 < 0.82 && r2 < 0.82) {
			chars.splice(-2, 0, ".");
			decimalInferred = true;
		}
		// Case 2: Last 1 digit is a shorter fractional digit (e.g. 10461.2)
		else if (r1 < 0.82 && r2 >= 0.85) {
			chars.splice(-1, 0, ".");
			decimalInferred = true;
		}
	}

	const reading = chars.join("").replace(/^\.+|\.+$/g, "");
	const digitCount = digitBoxes.length;
	const avgConfidence =
		confs.length > 0
			? Number.parseFloat(
					(confs.reduce((a, b) => a + b, 0) / confs.length).toFixed(3),
				)
			: 0.0;

	// Determine QA Status and Safety Hazard Reason
	let qaStatus: QAStatus;
	let hazardReason: string | null = null;

	if (meanLuma < 25) {
		qaStatus = "CRITICAL_HAZARD";
		hazardReason = "Severe optical occlusion / pitch black frame detected";
	} else if (panelConfidence < 0.25) {
		qaStatus = "CRITICAL_HAZARD";
		hazardReason = "Meter LCD casing boundary not found";
	} else if (digitCount < 3) {
		qaStatus = "CRITICAL_HAZARD";
		hazardReason =
			"Illegible seven-segment display: fewer than 3 digits detected";
	} else if (absTilt > 20) {
		qaStatus = "WARNING";
		hazardReason = "Suboptimal LCD contrast / specular reflection detected";
	} else if (decimalInferred) {
		qaStatus = "WARNING";
		hazardReason = "Fractional decimal point heuristically inferred";
	} else if (avgConfidence < 0.7) {
		qaStatus = "WARNING";
		hazardReason = "Low OCR character confidence score";
	} else {
		qaStatus = "PASS";
		hazardReason = null;
	}

	const extractedKwh =
		reading && qaStatus !== "CRITICAL_HAZARD"
			? Number.parseFloat(reading)
			: null;

	return {
		reading: reading || "UNREADABLE",
		digitCount,
		avgConfidence,
		decimalInferred,
		extractedKwh: Number.isNaN(extractedKwh) ? null : extractedKwh,
		qaStatus,
		hazardReason,
	};
}
