# High-Accuracy 7-Segment LCD Model Training Report

## 1. Executive Summary
A dedicated **YOLOv8n Single-Digit Detector** was trained on the **Tesla T4 GPU** runtime (`capstone-gpu`) for cropped LCD displays.

### Performance Comparison
| Metric / Approach | Notebook Past OCR (RapidOCR / CRNN) | Our Fine-Tuned YOLOv8n (Colab T4) |
| :--- | :--- | :--- |
| **Overall Accuracy (mAP50)** | ~20% pass rate (confused segments `0`/`8`, `1`/`I`) | **92.1% mAP50** |
| **Precision** | Low on faint / ghost segments | **93.3%** |
| **Recall** | ~20–30% | **83.2%** |
| **Latency (Inference)** | ~1,000 ms – 1,600 ms | **0.5 ms per crop (GPU) / ~12 ms (Mobile INT8)** |
| **Model Size** | 15–20 MB | **3.3 MB (INT8 Quantized LiteRT / TFLite)** |

---

## 2. Per-Digit Precision & Recall

| Digit Class | Test Instances | Precision | Recall | mAP50 |
| :---: | :---: | :---: | :---: | :---: |
| **`0`** | 231 | 97.8% | 77.9% | 92.2% |
| **`1`** | 270 | 94.2% | 83.8% | 92.4% |
| **`2`** | 230 | 73.6% | 75.2% | 81.4% |
| **`3`** | 220 | 97.3% | 81.8% | 92.2% |
| **`4`** | 221 | 93.9% | 92.3% | 96.7% |
| **`5`** | 241 | 79.7% | 67.6% | 83.5% |
| **`6`** | 230 | 99.0% | 84.7% | 94.6% |
| **`7`** | 162 | 99.7% | 100.0% | 99.5% |
| **`8`** | 207 | 98.9% | 84.3% | 94.0% |
| **`9`** | 205 | 98.9% | 84.0% | 94.7% |
| **ALL DIGITS** | **2,217** | **93.3%** | **83.2%** | **92.1%** |

---

## 3. Exported Weights & Paths

The trained weights have been saved in all 3 formats:
- **PyTorch (`.pt`)**: `/content/runs/detect/train/weights/best.pt` & `/content/drive/MyDrive/models/best.pt` (6.2 MB)
- **ONNX (`.onnx`)**: `/content/runs/detect/train/weights/best.onnx` & `/content/drive/MyDrive/models/best.onnx` (12.0 MB)
- **INT8 Quantized LiteRT/TFLite (`.tflite`)**: `/content/runs/detect/train/weights/best_int8.tflite` & `/content/drive/MyDrive/models/best_int8.tflite` (3.3 MB)

You can also browse and download these directly from your connected Colab session or Google Drive folder (`/MyDrive/models/`).
