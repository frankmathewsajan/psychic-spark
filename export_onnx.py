import shutil
from pathlib import Path
from ultralytics import YOLO

MODELS_DIR = Path(__file__).resolve().parent / "models"

def main():
    print("--- 1. Exporting Stage 1: Panel Detector (640x640) ---")
    panel_model = YOLO(MODELS_DIR / "manu_panel_best.pt")
    exported_panel = Path(
        panel_model.export(
            format="onnx",
            imgsz=640,
            opset=17,
            simplify=True,
            nms=False,
            dynamic=False,
        )
    )
    target_panel = MODELS_DIR / "manu_panel_best_640.onnx"
    shutil.move(str(exported_panel), str(target_panel))
    print(f"Saved: {target_panel} ({target_panel.stat().st_size / (1024*1024):.2f} MB)")

    print("\n--- 2. Exporting Stage 2: 7-Segment Digit Reader (320x320) ---")
    digit_model_320 = YOLO(MODELS_DIR / "liamm_7seg_best.pt")
    exported_320 = Path(
        digit_model_320.export(
            format="onnx",
            imgsz=320,
            opset=17,
            simplify=True,
            nms=False,
            dynamic=False,
        )
    )
    target_320 = MODELS_DIR / "liamm_7seg_best_320.onnx"
    shutil.move(str(exported_320), str(target_320))
    print(f"Saved: {target_320} ({target_320.stat().st_size / (1024*1024):.2f} MB)")

    print("\n--- 3. Exporting Stage 2: 7-Segment Digit Reader (640x640) ---")
    digit_model_640 = YOLO(MODELS_DIR / "liamm_7seg_best.pt")
    exported_640 = Path(
        digit_model_640.export(
            format="onnx",
            imgsz=640,
            opset=17,
            simplify=True,
            nms=False,
            dynamic=False,
        )
    )
    target_640 = MODELS_DIR / "liamm_7seg_best_640.onnx"
    shutil.move(str(exported_640), str(target_640))
    print(f"Saved: {target_640} ({target_640.stat().st_size / (1024*1024):.2f} MB)")

    print("\n[SUCCESS] Exported all 3 ONNX checkpoints cleanly into models/.")

if __name__ == "__main__":
    main()
