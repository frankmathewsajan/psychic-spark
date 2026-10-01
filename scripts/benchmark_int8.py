#!/usr/bin/env python3
"""
INT8 Quantized MobileNetV3-Large Benchmark Harness
Validates university thesis target constraints:
  - Latency: < 250 ms (Single-threaded CPU)
  - Memory:  < 35 MB Peak RAM Allocation
Maps inference output to project QAStatus and ocr_confidence contracts.
"""

from __future__ import annotations

import json
import statistics
import time
import tracemalloc
from datetime import UTC, datetime

import torch
import torchvision.models.quantization as models_quantization


def run_benchmark() -> None:
    # 1. Enforce deterministic, single-threaded CPU execution (edge device simulation)
    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)

    print("=" * 60)
    print("RDSS INT8 MobileNetV3-Large Edge Inference Benchmark")
    print(f"PyTorch Version: {torch.__version__} | Single-threaded CPU")
    print("=" * 60)

    # 2. Memory Profiling Initialization
    tracemalloc.start()
    tracemalloc.reset_peak()

    # 3. Model Instantiation & INT8 Quantization Loading
    weights = models_quantization.MobileNet_V3_Large_QuantizedWeights.DEFAULT
    model = models_quantization.mobilenet_v3_large(weights=weights, quantize=True)
    model.eval()

    # Fixed input dimensions matching standard MobileNetV3 ingestion (Batch=1, C=3, H=224, W=224)
    dummy_input = torch.randn(1, 3, 224, 224)

    # 4. Warm-Up Cycles (stabilize CPU frequency scaling and cache lines)
    with torch.inference_mode():
        for _ in range(5):
            _ = model(dummy_input)

    # 5. Latency Benchmark: 20 Timed Iterations
    latencies_ms: list[float] = []
    last_output: torch.Tensor | None = None

    with torch.inference_mode():
        for _ in range(20):
            t_start = time.perf_counter()
            last_output = model(dummy_input)
            t_end = time.perf_counter()
            latencies_ms.append((t_end - t_start) * 1000.0)

    # 6. Memory Extraction
    _, peak_bytes = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    peak_ram_mb = peak_bytes / (1024 * 1024)

    # 7. Metrics Aggregation
    mean_lat = statistics.mean(latencies_ms)
    median_lat = statistics.median(latencies_ms)
    p95_lat = sorted(latencies_ms)[int(0.95 * len(latencies_ms))]
    min_lat = min(latencies_ms)
    max_lat = max(latencies_ms)

    # 8. Schema Contract Mapping
    assert last_output is not None
    probabilities = torch.softmax(last_output[0], dim=0)
    top_prob, _ = torch.topk(probabilities, 1)
    ocr_confidence = round(float(top_prob.item()), 3)

    if ocr_confidence >= 0.85:
        qa_status = "PASS"
        hazard_reason = None
    elif ocr_confidence >= 0.60:
        qa_status = "WARNING"
        hazard_reason = "Suboptimal LCD contrast / specular reflection detected"
    else:
        qa_status = "CRITICAL_HAZARD"
        hazard_reason = "Suspected optical occlusion / illegible seven-segment display"

    contract_payload = {
        "id": "ins_bench_mobile_int8",
        "technician_id": "TECH_BENCHMARK_PROFILER",
        "meter_serial_number": "MTR-INT8-BENCHMARK",
        "timestamp_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "geo": [19.0760, 72.8777],
        "qa_status": qa_status,
        "hazard_reason": hazard_reason,
        "kwh_reading": 1284.7,
        "ocr_confidence": ocr_confidence,
    }

    # 9. Output Results
    print("\n[LATENCY BENCHMARK (20 iterations)]")
    print(f"  Mean Latency:    {mean_lat:.2f} ms")
    print(f"  Median Latency:  {median_lat:.2f} ms")
    print(f"  P95 Latency:     {p95_lat:.2f} ms")
    print(f"  Min / Max:       {min_lat:.2f} ms / {max_lat:.2f} ms")
    print(f"  Thesis Threshold: < 250.00 ms -> {'PASS' if mean_lat < 250 else 'FAIL'}")

    print("\n[HEAP ALLOCATION PROFILING]")
    print(f"  Peak RAM:        {peak_ram_mb:.2f} MB")
    print(
        f"  Thesis Threshold: < 35.00 MB   -> {'PASS' if peak_ram_mb < 35 else 'FAIL'}"
    )

    print("\n[GENERATED CONTRACT PAYLOAD]")
    print(json.dumps(contract_payload, indent=2))


if __name__ == "__main__":
    run_benchmark()
