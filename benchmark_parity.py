import argparse
import sys
from pathlib import Path
import cv2
import numpy as np
from ultralytics import YOLO

MODELS_DIR = Path(__file__).resolve().parent / "models"
SAMPLES_DIR = Path(__file__).resolve().parent / "sample_images"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def compute_iou(boxA, boxB):
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
    boxAArea = max(0.0, boxA[2] - boxA[0]) * max(0.0, boxA[3] - boxA[1])
    boxBArea = max(0.0, boxB[2] - boxB[0]) * max(0.0, boxB[3] - boxB[1])
    denom = boxAArea + boxBArea - interArea
    return interArea / denom if denom > 0 else 0.0


def deduplicate_horizontal(detections, overlap_ratio=0.5):
    """Remove duplicate boxes detecting the same digit at nearly the same X position."""
    detections = sorted(detections, key=lambda d: d["conf"], reverse=True)
    kept = []
    for det in detections:
        x1, _, x2, _ = det["box"]
        w = max(x2 - x1, 1.0)
        is_dup = False
        for k in kept:
            kx1, _, kx2, _ = k["box"]
            kw = max(kx2 - kx1, 1.0)
            inter = max(0.0, min(x2, kx2) - max(x1, kx1))
            if inter / min(w, kw) > overlap_ratio:
                is_dup = True
                break
        if not is_dup:
            kept.append(det)
    return sorted(kept, key=lambda d: d["x_center"])


def assemble_digits(detections, apply_height_fallback=False):
    """Assembles left-to-right digit sequence with strict double-decimal prevention."""
    ordered = deduplicate_horizontal(detections)
    chars = []
    digit_boxes = []
    has_explicit_dot = False

    for d in ordered:
        lbl = d["label"]
        if lbl in {".", "dot", "decimal", "point"}:
            if not has_explicit_dot and len(chars) > 0:
                chars.append(".")
                has_explicit_dot = True
        elif lbl.isdigit() and len(lbl) == 1:
            chars.append(lbl)
            x1, y1, x2, y2 = d["box"]
            digit_boxes.append((lbl, y2 - y1))

    # Height-ratio fallback: Only if no explicit dot exists and digits >= 5
    if apply_height_fallback and not has_explicit_dot and len(digit_boxes) >= 5:
        # Calculate average height of first 3 whole digits
        ref_digits = digit_boxes[:max(3, len(digit_boxes) - 2)]
        avg_h = sum(h for _, h in ref_digits) / len(ref_digits)

        ratios = [h / avg_h for _, h in digit_boxes]

        # Case 1: Last 2 digits are short fractional digits (e.g. 1046.12)
        if len(ratios) >= 5 and ratios[-1] < 0.82 and ratios[-2] < 0.82:
            chars.insert(-2, ".")
        # Case 2: Last 1 digit is a short fractional digit (e.g. 10461.2)
        elif len(ratios) >= 5 and ratios[-1] < 0.82 and ratios[-2] >= 0.85:
            chars.insert(-1, ".")

    reading = "".join(chars).strip(".")
    return reading


def extract_dets(results, model_names):
    dets = []
    if len(results.boxes) == 0:
        return dets
    for box in results.boxes:
        cls_id = int(box.cls[0])
        label = str(model_names[cls_id]).strip().lower()
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        conf = float(box.conf[0])
        dets.append({
            "label": label,
            "conf": conf,
            "box": (x1, y1, x2, y2),
            "x_center": (x1 + x2) / 2.0,
        })
    return dets


def main():
    parser = argparse.ArgumentParser(description="Stage 1 & 2 Parity and Resolution Benchmark")
    parser.add_argument("--input", default=str(SAMPLES_DIR), help="Directory of sample images")
    args = parser.parse_args()

    input_dir = Path(args.input)
    images = sorted(p for p in input_dir.rglob("*") if p.suffix.lower() in IMAGE_EXTS)
    print(f"Loaded {len(images)} sample images for benchmark.\n")

    # Load Stage 1 models
    print("Loading Stage 1 models...")
    s1_pt = YOLO(MODELS_DIR / "manu_panel_best.pt")
    s1_onnx = YOLO(MODELS_DIR / "manu_panel_best_640.onnx")

    # Load Stage 2 models
    print("Loading Stage 2 models...")
    s2_pt = YOLO(MODELS_DIR / "liamm_7seg_best.pt")
    s2_onnx_320 = YOLO(MODELS_DIR / "liamm_7seg_best_320.onnx")

    # Metrics accumulators
    s1_ious = []
    s1_conf_deltas = []
    s2_math_matches = 0
    s2_ious_320 = []
    s2_conf_deltas_320 = []
    res_agreements = 0

    print("\n" + "="*112)
    print(f"{'IMAGE':<32} | {'S1 IoU':<7} | {'S1 DConf':<8} | {'PT 320':<12} | {'ONNX 320':<12} | {'S2 Parity':<9} | {'PT 640':<12} | {'FINAL (FALLBACK)'}")
    print("="*112)

    for img_path in images:
        img_bgr = cv2.imread(str(img_path))
        if img_bgr is None:
            continue
        h, w = img_bgr.shape[:2]

        # ---------------------------------------------------------
        # 1. STAGE 1: Panel Detection (PyTorch 640 vs ONNX 640)
        # ---------------------------------------------------------
        res_s1_pt = s1_pt.predict(img_bgr, imgsz=640, conf=0.25, verbose=False)[0]
        res_s1_onnx = s1_onnx.predict(img_bgr, imgsz=640, conf=0.25, verbose=False)[0]

        has_pt_box = len(res_s1_pt.boxes) > 0
        has_onnx_box = len(res_s1_onnx.boxes) > 0

        if not has_pt_box and not has_onnx_box:
            # Edge-case: Non-meter graphic (e.g. manu_panel_image.jpg) -> Exact match
            s1_iou = 1.0
            s1_conf_delta = 0.0
            crop_shared = img_bgr.copy()
        elif has_pt_box and has_onnx_box:
            best_pt = max(res_s1_pt.boxes, key=lambda b: float(b.conf[0]))
            best_onnx = max(res_s1_onnx.boxes, key=lambda b: float(b.conf[0]))
            box_pt = best_pt.xyxy[0].tolist()
            box_onnx = best_onnx.xyxy[0].tolist()
            s1_iou = compute_iou(box_pt, box_onnx)
            s1_conf_delta = abs(float(best_pt.conf[0]) - float(best_onnx.conf[0]))

            # Crop shared LCD display with 5% padding
            x1, y1, x2, y2 = box_pt
            pad_x = (x2 - x1) * 0.05
            pad_y = (y2 - y1) * 0.05
            cx1 = max(0, int(x1 - pad_x))
            cy1 = max(0, int(y1 - pad_y))
            cx2 = min(w, int(x2 + pad_x))
            cy2 = min(h, int(y2 + pad_y))
            crop_shared = img_bgr[cy1:cy2, cx1:cx2]
        else:
            s1_iou = 0.0
            s1_conf_delta = 1.0
            crop_shared = img_bgr.copy()

        s1_ious.append(s1_iou)
        s1_conf_deltas.append(s1_conf_delta)

        # ---------------------------------------------------------
        # 2. STAGE 2: Isolated Math Parity (PT 320 vs ONNX 320)
        # ---------------------------------------------------------
        res_s2_pt_320 = s2_pt.predict(crop_shared, imgsz=320, conf=0.30, verbose=False)[0]
        res_s2_onnx_320 = s2_onnx_320.predict(crop_shared, imgsz=320, conf=0.30, verbose=False)[0]

        dets_pt_320 = extract_dets(res_s2_pt_320, s2_pt.names)
        dets_onnx_320 = extract_dets(res_s2_onnx_320, s2_onnx_320.names)

        # Compare math parity on boxes
        if len(dets_pt_320) == len(dets_onnx_320):
            box_ious = [
                compute_iou(d1["box"], d2["box"])
                for d1, d2 in zip(sorted(dets_pt_320, key=lambda x: x["x_center"]),
                                 sorted(dets_onnx_320, key=lambda x: x["x_center"]))
            ]
            conf_deltas = [
                abs(d1["conf"] - d2["conf"])
                for d1, d2 in zip(sorted(dets_pt_320, key=lambda x: x["x_center"]),
                                 sorted(dets_onnx_320, key=lambda x: x["x_center"]))
            ]
            s2_ious_320.append(np.mean(box_ious) if box_ious else 1.0)
            s2_conf_deltas_320.append(np.max(conf_deltas) if conf_deltas else 0.0)
        else:
            s2_ious_320.append(0.0)
            s2_conf_deltas_320.append(1.0)

        read_pt_320 = assemble_digits(dets_pt_320, apply_height_fallback=False) or "NONE"
        read_onnx_320 = assemble_digits(dets_onnx_320, apply_height_fallback=False) or "NONE"

        s2_match = (read_pt_320 == read_onnx_320)
        if s2_match:
            s2_math_matches += 1

        # ---------------------------------------------------------
        # 3. STAGE 2: Resolution Check (PT 640 vs ONNX 320)
        # ---------------------------------------------------------
        res_s2_pt_640 = s2_pt.predict(crop_shared, imgsz=640, conf=0.30, verbose=False)[0]
        dets_pt_640 = extract_dets(res_s2_pt_640, s2_pt.names)
        read_pt_640 = assemble_digits(dets_pt_640, apply_height_fallback=False) or "NONE"

        if read_pt_640 == read_onnx_320:
            res_agreements += 1

        # Final reading with height-ratio fallback
        read_final = assemble_digits(dets_onnx_320, apply_height_fallback=True) or "UNREADABLE"

        status_flag = "PASS" if s2_match else "DIFF"
        print(f"{img_path.name[:32]:<32} | {s1_iou:<7.3f} | {s1_conf_delta:<8.4f} | {read_pt_320:<12} | {read_onnx_320:<12} | {status_flag:<9} | {read_pt_640:<12} | {read_final}")

    print("="*112)
    print("\n--- BENCHMARK SUMMARY (84 Sample Images) ---")
    print(f"Stage 1 Mean IoU:                   {np.mean(s1_ious):.4f} (Target: > 0.98)")
    print(f"Stage 1 Max Conf Delta:             {np.max(s1_conf_deltas):.4f} (Target: < 0.01)")
    print(f"Stage 2 Math Parity (320 vs 320):   {s2_math_matches}/{len(images)} ({s2_math_matches/len(images)*100:.1f}%) exact string matches")
    print(f"Stage 2 (320) Mean Box IoU:         {np.mean(s2_ious_320):.4f} (Target: > 0.98)")
    print(f"Stage 2 (320) Max Conf Delta:       {np.max(s2_conf_deltas_320):.4f} (Target: < 0.01)")
    print(f"Resolution Agreement (640 vs 320):  {res_agreements}/{len(images)} ({res_agreements/len(images)*100:.1f}%)")


if __name__ == "__main__":
    main()
