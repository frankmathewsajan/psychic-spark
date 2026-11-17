import argparse
import json
from pathlib import Path
import cv2
from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
SAMPLES_DIR = BASE_DIR / "sample_images"
OUTPUTS_DIR = BASE_DIR / "outputs"

PANEL_MODEL_PATH = MODELS_DIR / "manu_panel_best.pt"
DIGIT_MODEL_PATH = MODELS_DIR / "liamm_7seg_best.pt"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


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


def predict_single(image_path: Path, panel_model: YOLO, digit_model: YOLO, conf_panel=0.25, conf_digit=0.30) -> dict:
    img = cv2.imread(str(image_path))
    if img is None:
        return {"image": image_path.name, "status": "error", "reading": None, "confidence": 0.0}

    h, w = img.shape[:2]

    # Stage 1: Locate & crop LCD display with 5% padding
    panel_results = panel_model.predict(img, conf=conf_panel, verbose=False)[0]
    if len(panel_results.boxes) == 0:
        crop = img.copy()
        panel_conf = 0.0
    else:
        best_box = max(panel_results.boxes, key=lambda b: float(b.conf[0]))
        panel_conf = float(best_box.conf[0])
        x1, y1, x2, y2 = best_box.xyxy[0].tolist()
        pad_x = (x2 - x1) * 0.05
        pad_y = (y2 - y1) * 0.05
        cx1 = max(0, int(x1 - pad_x))
        cy1 = max(0, int(y1 - pad_y))
        cx2 = min(w, int(x2 + pad_x))
        cy2 = min(h, int(y2 + pad_y))
        crop = img[cy1:cy2, cx1:cx2]

    stem = image_path.stem
    cv2.imwrite(str(OUTPUTS_DIR / f"{stem}_crop.jpg"), crop)

    # Stage 2: Detect 7-segment digits & decimal point on the high-res crop
    digit_results = digit_model.predict(crop, conf=conf_digit, verbose=False)[0]
    cv2.imwrite(str(OUTPUTS_DIR / f"{stem}_annotated.jpg"), digit_results.plot())

    raw_dets = []
    for box in digit_results.boxes:
        cls_id = int(box.cls[0])
        label = str(digit_model.names[cls_id]).strip().lower()
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        raw_dets.append({
            "label": label,
            "conf": float(box.conf[0]),
            "box": (x1, y1, x2, y2),
            "x_center": (x1 + x2) / 2.0,
        })

    ordered_dets = deduplicate_horizontal(raw_dets)

    chars = []
    confs = []
    for d in ordered_dets:
        lbl = d["label"]
        if lbl in {".", "dot", "decimal", "point"}:
            if "." not in chars and len(chars) > 0:
                chars.append(".")
                confs.append(d["conf"])
        elif lbl.isdigit() and len(lbl) == 1:
            chars.append(lbl)
            confs.append(d["conf"])

    reading = "".join(chars).strip(".")
    digit_count = sum(c.isdigit() for c in reading)
    avg_conf = round(sum(confs) / len(confs), 3) if confs else 0.0

    # Require at least 3 digits to avoid stray noise reads
    if digit_count < 3:
        return {"image": image_path.name, "status": "unreadable", "reading": None, "confidence": avg_conf}

    return {
        "image": image_path.name,
        "status": "ok",
        "reading": reading,
        "panel_confidence": round(panel_conf, 3),
        "confidence": avg_conf,
    }


def main():
    parser = argparse.ArgumentParser(description="2-Model Digital Meter Reader")
    parser.add_argument("--input", default=str(SAMPLES_DIR), help="Image file or folder (default: sample_images/)")
    parser.add_argument("--json", action="store_true", help="Output JSON instead of table")
    args = parser.parse_args()

    target = Path(args.input)
    images = [target] if target.is_file() else sorted(p for p in target.rglob("*") if p.suffix.lower() in IMAGE_EXTS)

    if not images:
        print(f"No images found in {target}.")
        return

    OUTPUTS_DIR.mkdir(exist_ok=True)
    panel_model = YOLO(str(PANEL_MODEL_PATH))
    digit_model = YOLO(str(DIGIT_MODEL_PATH))

    results = [predict_single(img_path, panel_model, digit_model) for img_path in images]

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print(f"{'IMAGE':<38} | {'READING':<12} | {'CONF'}")
        print("-" * 62)
        for r in results:
            val = r["reading"] if r["status"] == "ok" else "UNREADABLE"
            print(f"{r['image']:<38} | {val:<12} | {r['confidence']:.2f}")


if __name__ == "__main__":
    main()
