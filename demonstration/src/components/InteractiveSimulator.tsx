import React, { useState } from "react";
import { AlertTriangle, CheckCircle, ShieldAlert, Cpu, Eye, Sparkles, Lock, RefreshCw } from "lucide-react";

type Scenario = "CLEAN" | "HAZARD" | "GLARE";

export function InteractiveSimulator() {
  const [scenario, setScenario] = useState<Scenario>("CLEAN");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleScenarioChange = (s: Scenario) => {
    setIsProcessing(true);
    setScenario(s);
    setTimeout(() => setIsProcessing(false), 300);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-elevation2 p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              Interactive 3-Tier Pipeline Simulator
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Simulate real-world field conditions with zero live database pollution.
          </p>
        </div>

        {/* SCENARIO SELECTOR */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 self-start sm:self-auto">
          <button
            onClick={() => handleScenarioChange("CLEAN")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              scenario === "CLEAN"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Clean Meter
          </button>
          <button
            onClick={() => handleScenarioChange("HAZARD")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              scenario === "HAZARD"
                ? "bg-red-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Exposed Wire Hazard
          </button>
          <button
            onClick={() => handleScenarioChange("GLARE")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              scenario === "GLARE"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Glary / Low-Contrast
          </button>
        </div>
      </div>

      {/* PIPELINE STAGES VIEW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {/* STAGE 1 */}
        <div className="flex flex-col border border-slate-200 rounded-xl p-4 bg-slate-50/50">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Stage 1: Safety Interlock
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">24.34 ms</span>
          </div>

          <div className="mt-4 flex-1 space-y-3">
            <div className="text-xs text-slate-600">
              Model: <span className="font-mono font-medium text-slate-800">mobilenetv3_wire_int8.tflite (1.24MB)</span>
            </div>

            {scenario === "HAZARD" ? (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs">
                <div className="flex items-center gap-1.5 text-red-700 font-bold">
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                  CRITICAL_HAZARD DETECTED
                </div>
                <p className="text-red-600 text-[11px] mt-1 leading-snug">
                  Probability: 0.942 (≥ 0.65 threshold). Loose wiring / unseated cover.
                </p>
                <div className="mt-2 text-[10px] font-mono text-red-800 bg-red-100 p-1.5 rounded">
                  [LOCKOUT ENFORCED]: Stage 2 OCR halted. Commit blocked.
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  PASS: Casing & Terminals Safe
                </div>
                <p className="text-emerald-600 text-[11px] mt-1">
                  Probability: 0.041 (Clear of hazards). Permitting Stage 2.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* STAGE 2 */}
        <div className="flex flex-col border border-slate-200 rounded-xl p-4 bg-slate-50/50">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Stage 2: Hybrid Edge OCR
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">68.10 ms</span>
          </div>

          <div className="mt-4 flex-1 space-y-3">
            <div className="text-xs text-slate-600">
              Reticle Bounds: <span className="font-mono text-slate-800">[0.18, 0.28, 0.64, 0.24]</span>
            </div>

            {scenario === "HAZARD" ? (
              <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-400 italic text-center">
                Stage bypassed due to Stage 1 safety interlock lockout.
              </div>
            ) : scenario === "GLARE" ? (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs">
                <div className="flex items-center gap-1.5 text-amber-700 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Low Contrast / Glare Flagged
                </div>
                <p className="text-amber-800 text-[11px] mt-1 font-mono">
                  Raw Read: "1428.?" (Confidence: 0.58)
                </p>
                <div className="mt-2 text-[10px] text-amber-900 bg-amber-100 p-1.5 rounded">
                  Queued for Tier-3 Cloud VLM Second-Verification.
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Clean 7-Segment Read
                </div>
                <div className="mt-1 font-mono text-lg font-bold text-slate-900">
                  1428.5 <span className="text-xs font-normal text-slate-500">kWh</span>
                </div>
                <p className="text-emerald-700 text-[11px] mt-1">Confidence: 0.962 (Sanitized)</p>
              </div>
            )}
          </div>
        </div>

        {/* STAGE 3 */}
        <div className="flex flex-col border border-slate-200 rounded-xl p-4 bg-slate-50/50">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Tier-3 VLM & 4-Point QC
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">Gemini 3.8 / 4</span>
          </div>

          <div className="mt-4 flex-1 space-y-2 text-xs">
            {scenario === "HAZARD" ? (
              <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-800">
                <div className="font-bold text-[11px]">Audit Verdict: HAZARD_CONFIRMED</div>
                <div className="text-[10px] mt-1 font-mono">wire_hazard_visible: true</div>
                <div className="text-[10px] font-mono">terminal_cover_seated: false</div>
              </div>
            ) : scenario === "GLARE" ? (
              <div className="p-2.5 rounded bg-teal-50 border border-teal-200 text-teal-900">
                <div className="font-bold text-[11px] text-teal-800">Audit Verdict: VLM_RECONCILED</div>
                <div className="text-[10px] mt-0.5 text-teal-700">Display glare filtered via multimodal attention.</div>
                <div className="text-[11px] font-mono font-bold mt-1">VLM kWh: 1428.5 (Reconciled)</div>
              </div>
            ) : (
              <div className="p-2.5 rounded bg-teal-50 border border-teal-200 text-teal-900">
                <div className="font-bold text-[11px] text-teal-800">Audit Verdict: VLM_VERIFIED</div>
                <div className="text-[10px] mt-0.5 text-teal-700">Complete match between Edge OCR & VLM.</div>
              </div>
            )}

            {/* 4-POINT SCORECARD SUMMARY */}
            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-200 text-[10px]">
              <div className="p-1 rounded bg-slate-100 flex justify-between">
                <span className="text-slate-500">Wire:</span>
                <span className={`font-bold ${scenario === "HAZARD" ? "text-red-700" : "text-emerald-700"}`}>
                  {scenario === "HAZARD" ? "HAZARD" : "SAFE"}
                </span>
              </div>
              <div className="p-1 rounded bg-slate-100 flex justify-between">
                <span className="text-slate-500">Cover:</span>
                <span className={`font-bold ${scenario === "HAZARD" ? "text-amber-700" : "text-emerald-700"}`}>
                  {scenario === "HAZARD" ? "UNSEATED" : "SEATED"}
                </span>
              </div>
              <div className="p-1 rounded bg-slate-100 flex justify-between">
                <span className="text-slate-500">Seal:</span>
                <span className="font-bold text-emerald-700">INTACT</span>
              </div>
              <div className="p-1 rounded bg-slate-100 flex justify-between">
                <span className="text-slate-500">Casing:</span>
                <span className="font-bold text-emerald-700">UNDAMAGED</span>
              </div>
            </div>

            {/* SHA-256 SEAL */}
            <div className="pt-2 text-[10px] font-mono text-slate-500">
              <span className="text-slate-400 block text-[9px] uppercase">SHA-256 Digest Seal:</span>
              <span className="break-all text-slate-700 font-semibold">
                e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
