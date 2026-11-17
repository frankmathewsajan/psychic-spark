import React from "react";

export function AsciiMeter({ reading = "01428.5", status = "PASS" }: { reading?: string; status?: string }) {
  const isPass = status === "PASS";
  return (
    <pre className="text-[10px] sm:text-xs font-mono leading-none bg-slate-900 text-cyan-400 p-4 rounded-xl border border-slate-800 shadow-xl overflow-x-auto select-none">
{`
  +---------------------------------------------+
  |  NOVO DIGITAL ENERGY METER  [TYPE: EB-402]  |
  |  IS: 13779 / IEC 62053-21   CLASS 1.0       |
  +---------------------------------------------+
  |  +---------------------------------------+  |
  |  |  [Active kWh]            [1.5x ZOOM]  |  |
  |  |                                       |  |
  |  |   [ ${reading.padStart(7, " ")} kWh ]                   |  |
  |  |                                       |  |
  |  |  (.) CALIB   [||||||||||||||||] 100%  |  |
  |  +---------------------------------------+  |
  |                                             |
  |   MTR S/N: EB-4820194         5-30A, 240V   |
  |   MFG: 11/2026                50Hz, 3200imp |
  +---------------------------------------------+
  | [!] OPTICAL PORT     [*] REV TAMP     STATUS|
  |      [ O ]               (OK)         [${isPass ? "PASS" : "HAZD"}] |
  +=============================================+
  |  TERMINAL BLOCK - 4-POINT PHYSICAL INSPECT  |
  |  [S1] PHASE_IN   [L1] PHASE_OUT   [TAMPER]  |
  |  (•) SEATED      (•) TORQUED      [ SEAL ]  |
  +---------------------------------------------+
`}
    </pre>
  );
}

export function AsciiPipeline() {
  return (
    <pre className="text-[9px] sm:text-[11px] font-mono leading-tight bg-slate-900 text-emerald-400 p-4 rounded-xl border border-slate-800 shadow-xl overflow-x-auto select-none">
{`
  +-------------------------------------------------------------------------------+
  |                     NOVO 3-TIER RESILIENT PIPELINE ARCHITECTURE               |
  +-------------------------------------------------------------------------------+
  |                                                                               |
  |  [ TIER 1: PHYSICAL EDGE ]      [ TIER 2: DEFERRED CELLULAR ]  [ TIER 3: SSOT ]|
  |  +-----------------------+      +---------------------------+  +-------------+|
  |  | CameraView (1x-2x)    |      | Wi-Fi / 4G Opportunistic  |  | Render Cloud||
  |  |   |                   |      | Ingestion Queue           |  | FastAPI Gateway|
  |  |   v                   |      |   |                       |  |   |         ||
  |  | MobileNetV3 INT8      |      |   v                       |  |   v         ||
  |  | Safety Lockout (<25ms)|=====>| Multipart JPEG/PNG Upload |=>| Gemini 3.8/4||
  |  |   | (If Safe)         |      | (Compressed Full-Res)     |  | Multimodal  ||
  |  |   v                   |      +---------------------------+  | VLM Auditor ||
  |  | ML Kit 7-Seg OCR      |                    |                +-------------+|
  |  | SQLite WAL Database   |                    v                       |       |
  |  | (100% Offline SSOT)   |      +---------------------------+         v       |
  |  +-----------------------+      | SHA-256 Digest Sealing    |===>[ Supabase ] |
  |              |                  | sha256(bytes + SN + time) |    [PostgreSQL] |
  |              +----------------->| Local Reconcile Loop      |    [ & Storage] |
  |                                 +---------------------------+                 |
  +-------------------------------------------------------------------------------+
`}
    </pre>
  );
}

export function AsciiHazard() {
  return (
    <pre className="text-[10px] sm:text-xs font-mono leading-none bg-red-950/80 text-red-400 p-4 rounded-xl border border-red-800 shadow-xl overflow-x-auto select-none">
{`
  /!\\ ========================================================= /!\\
  |                  SAFETY INTERLOCK ENGAGED                   |
  |                  CRITICAL HAZARD DETECTED                   |
  \\!/ ========================================================= \\!/
  |                                                             |
  |   CLASSIFICATION: UNSEATED TERMINAL COVER / EXPOSED WIRES   |
  |   MODEL: mobilenetv3_wire_int8.tflite (1.24 MB Edge INT8)   |
  |   LATENCY: 24.34 ms (Real Edge CPU)                         |
  |   PROBABILITY: 0.942 (Threshold >= 0.650)                   |
  |                                                             |
  |   ACTION ENFORCED:                                          |
  |   [x] Stage 2 LCD OCR Execution Halted                      |
  |   [x] Inspection Commit Locked Out                          |
  |   [x] Visual Red Alert Dispatched to Technician HUD         |
  +-------------------------------------------------------------+
`}
    </pre>
  );
}

export function AsciiDiscomSeal() {
  return (
    <pre className="text-[9px] sm:text-[11px] font-mono leading-tight bg-slate-900 text-amber-400 p-3 rounded-xl border border-slate-800 shadow-xl overflow-x-auto select-none">
{`
  +-------------------------------------------------------------+
  |              OFFICIAL DISCOM AUDIT COMPLIANCE SEAL          |
  |                  CENTRAL ELECTRICITY AUTHORITY              |
  +-------------------------------------------------------------+
  |  [✓] WIRE SAFETY CHECK        : PASS (No Bare Conductors)   |
  |  [✓] TERMINAL COVER SEATING   : PROPERLY SEATED             |
  |  [✓] TAMPER SEAL INTEGRITY    : INTACT (LEAD WIRE VERIFIED) |
  |  [✓] ENCLOSURE CASING         : UNDAMAGED & CRACK-FREE      |
  +-------------------------------------------------------------+
  |  EVIDENCE SHA-256 HASH DIGEST:                              |
  |  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b  |
  |  TIMESTAMP: 2026-11-17T09:04:49Z | STATUS: 100% REGULATORY |
  +-------------------------------------------------------------+
`}
    </pre>
  );
}
