import { SpeakerNoteData } from "../components/SpeakerNotes";

export interface SlideData {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  asciiType?: "meter" | "pipeline" | "hazard" | "discom";
  points?: string[];
  metrics?: { label: string; value: string; desc: string; color?: string }[];
  codeSnippet?: string;
  notes: SpeakerNoteData;
}

export const SLIDES: SlideData[] = [
  {
    id: "title",
    category: "Project Overview",
    title: "NOVO: Edge-AI Quality Assurance & Smart Meter Inspection Platform",
    subtitle: "Offline-First Field Verification, Dynamic Reticle Cropping & Tier-3 Multimodal Cloud VLM SSOT",
    asciiType: "meter",
    points: [
      "Final Engineering Viva Defense & Technical Demonstration",
      "Designed for Indian State Distribution Utilities (DISCOMs) & Power Sector Contractors",
      "End-to-End Pipeline: Expo React Native 0.88 + MobileNetV3 INT8 + FastAPI + Supabase + Gemini 3.8/4",
    ],
    notes: {
      keyTakeaway: "NOVO replaces flawed manual meter audits with edge-AI safety and multimodal VLM verification.",
      talkingPoints: [
        "Good morning respected external examiners and faculty members. Today I am presenting NOVO, an offline-first Edge-AI quality control and meter inspection system.",
        "The project addresses a critical industry problem: Indian electricity distribution companies lose over ₹30,000 Crore annually due to billing inaccuracies, unrecorded tamper events, and dangerous field wiring.",
        "NOVO provides automated point-of-work safety lockouts, hybrid edge OCR, and two-tier cryptographic reconciliation."
      ],
      examinerQuestions: [
        {
          question: "Why can't utilities just use standard cloud OCR apps?",
          answer: "Field technicians work in dense urban basements and remote rural feeders with zero cellular connectivity. Standard cloud APIs freeze or fail entirely offline. NOVO operates 100% offline at the point of capture and synchronizes opportunistically."
        }
      ]
    }
  },
  {
    id: "problem",
    category: "Industry Problem",
    title: "The ₹30,000 Crore Utility Dilemma: AT&C Losses & Field Hazards",
    subtitle: "High failure rates in manual meter reading and post-installation audit bottlenecks",
    points: [
      "Aggregated Technical & Commercial (AT&C) Losses: Indian DISCOMs face 15-22% losses due to non-technical leakage.",
      "Deadlock of Manual Inspection: Technicians manually key in 6-digit LCD readings, causing a 6.8% human transcription error rate.",
      "Safety Catastrophes: Bypassed terminal blocks and unseated terminal covers cause high-voltage arc flashes and electrocution.",
      "Legacy Audit Deficit: Central Electricity Authority (IS 2500) mandates sampling only 10-20% of installations due to audit costs."
    ],
    metrics: [
      { label: "Annual DISCOM Loss", value: "₹30,000 Cr", desc: "Commercial & technical leakage", color: "text-red-600" },
      { label: "Manual OCR Error", value: "6.8%", desc: "Typographical transcription drift", color: "text-amber-600" },
      { label: "Post-Audit Coverage", value: "10–20%", desc: "Legacy lot sampling deficit", color: "text-slate-600" }
    ],
    notes: {
      keyTakeaway: "Manual audits leave 80% of meters unverified and technicians exposed to electrical hazards.",
      talkingPoints: [
        "In India, the Revamped Distribution Sector Scheme (RDSS) is deploying 250 million smart meters. However, installation quality control remains manual.",
        "Contractor technicians often photograph blurry meters, type false numbers to meet daily quotas, or leave exposed live wiring.",
        "NOVO automates 100% inspection coverage at zero extra labor cost by embedding AI directly into the technician's mobile phone."
      ],
      examinerQuestions: [
        {
          question: "How does NOVO improve over smart meter AMI (Automated Metering Infrastructure)?",
          answer: "AMI only transmits meter data if the meter is correctly installed and energized. It cannot detect physical wire hazards, cracked enclosures, unseated covers, or magnetic tamper seals before turning on the power."
        }
      ]
    }
  },
  {
    id: "architecture",
    category: "System Design",
    title: "3-Tier Resilient Offline Architecture",
    subtitle: "Decoupling safety-critical edge execution from asynchronous cloud verification",
    asciiType: "pipeline",
    points: [
      "Tier 1 (Physical Edge): On-device MobileNetV3 INT8 + ML Kit OCR on local SQLite WAL. Works 100% offline without cellular connectivity.",
      "Tier 2 (Deferred Cellular Sync): Batched JSON telemetry (< 2 KB per 15 records) over 2G/EDGE cellular with exponential backoff and jitter.",
      "Tier 3 (Cloud VLM SSOT): Asynchronous background verification via Gemini 3.8 Flash / Gemini 4 Hydrogen, 4-Point Physical QC Scorecards, and SHA-256 sealing."
    ],
    notes: {
      keyTakeaway: "The 3-tier architecture ensures zero field downtime while providing cloud-grade audit scrutiny.",
      talkingPoints: [
        "Our architecture decouples latency-critical tasks from connectivity.",
        "Tier 1 guarantees that safety interlocks and OCR run instantaneously on-device in under 25 milliseconds.",
        "Tier 2 queues compressed metadata for opportunistic sync over 2G cellular.",
        "Tier 3 acts as the supervisory Single Source of Truth (SSOT), auditing installations in the cloud with large multimodal models."
      ],
      examinerQuestions: [
        {
          question: "What happens if the phone battery dies or restarts during sync?",
          answer: "All inspection records and state transitions are committed to SQLite in Write-Ahead Logging (WAL) mode before network transmission. Retries are idempotent via unique inspection IDs."
        }
      ]
    }
  },
  {
    id: "safety-interlock",
    category: "Stage 1 Edge AI",
    title: "Safety Interlock: MobileNetV3 INT8 Wire Hazard Detection",
    subtitle: "Sub-25 ms deterministic hardware lockout preventing dangerous meter energization",
    asciiType: "hazard",
    points: [
      "Quantized MobileNetV3 INT8 Model: 1.24 MB bundled binary running natively via react-native-fast-tflite.",
      "Deterministic Safety Gate: Evaluates input RGB tensor at Gate 0 with mean luminance checking.",
      "Immediate Lockout: When wire hazard probability P ≥ 0.65, halts Stage 2 OCR and prevents job submission in 24.34 ms.",
      "Zero Silent Failures: Forces technician to re-terminate loose wiring and fix unseated covers before proceeding."
    ],
    metrics: [
      { label: "Binary Footprint", value: "1.24 MB", desc: "Quantized MobileNetV3 INT8", color: "text-blue-600" },
      { label: "Execution Latency", value: "24.34 ms", desc: "Mean inference on mobile CPU", color: "text-emerald-600" },
      { label: "Lockout Threshold", value: "P ≥ 0.65", desc: "Hardware safety trip point", color: "text-red-600" }
    ],
    notes: {
      keyTakeaway: "Safety is enforced deterministically on-device before any reading can be recorded.",
      talkingPoints: [
        "In electrical engineering, safety precedes measurement. Stage 1 executes before OCR.",
        "We quantized MobileNetV3 to INT8 weights, shrinking the model to only 1.24 MB so it loads into mobile RAM instantly.",
        "On test Android hardware, the classification takes just 24.34 ms. If loose wires or missing covers are detected, the UI instantly disables commit."
      ],
      examinerQuestions: [
        {
          question: "Why use MobileNetV3 instead of YOLO for wire detection?",
          answer: "Object detectors like YOLOv8n require over 250ms and 150MB RAM on low-end phones. MobileNetV3 INT8 binary classification requires only 24.34ms and 4.59MB peak RAM, perfectly fitting low-tier DISCOM utility hardware."
        }
      ]
    }
  },
  {
    id: "hybrid-ocr",
    category: "Stage 2 Edge Vision",
    title: "Exact Reticle Cropping & Hybrid 7-Segment OCR",
    subtitle: "Screen-to-sensor aspect ratio calibration with 0 silent transcription misreads",
    points: [
      "Compact Zoom Presets: 1x, 1.5x, 2x pills allowing safe meter framing from 1.5 meters away.",
      "Screen-to-Sensor Mapping: Computes clamped normalized bounds [normX, normY, normW, normH] compensating for cover scaling and portrait sensor rotation.",
      "7-Segment Character Automaton: Deterministically sanitizes ambiguous digital LCD tokens (e.g., 'O'/'D' -> '0', 'I'/'l' -> '1', 'Z' -> '2', 'S' -> '5').",
      "Bounding Box Decimal Inference: Automatically detects fractional kWh decimal points from glyph height and baseline ratios."
    ],
    codeSnippet: `// Clamped Screen-to-Sensor Reticle Mapping
const scale = Math.max(screenW / sensorW, screenH / sensorH);
const rawX = Math.max(0, (box.x + offsetX) / scale);
const rawY = Math.max(0, (box.y + offsetY) / scale);
const normBounds = [
  clamp(rawX / sensorW, 0, 0.95),
  clamp(rawY / sensorH, 0, 0.95),
  clamp(rawW / sensorW, 0.05, 1 - normX),
  clamp(rawH / sensorH, 0.05, 1 - normY)
];`,
    notes: {
      keyTakeaway: "Geometric reticle cropping eliminates background clutter while sanitization prevents OCR hallucinations.",
      talkingPoints: [
        "Stage 2 solves a common computer vision flaw: background reflections on polycarbonate meter glass confuse OCR engines.",
        "We dynamically map the viewfinder's 7-segment display reticle directly to sensor coordinates.",
        "The crop is passed through our sanitization automaton, mapping typical 7-segment optical ambiguities to true digits."
      ],
      examinerQuestions: [
        {
          question: "How do you handle meters with decimal places like 1428.5 kWh?",
          answer: "Our pipeline checks the aspect ratio and vertical offset of the trailing digit. If smaller or accompanied by an optical point, the decimal flag is inferred and confirmed during Tier-3 cloud reconciliation."
        }
      ]
    }
  },
  {
    id: "cloud-vlm",
    category: "Tier-3 Cloud Audit",
    title: "Tier-3 Cloud VLM Auditor & 4-Point Physical QC Scorecard",
    subtitle: "Asynchronous multimodal verification using Gemini 3.8 Flash & Gemini 4 Hydrogen",
    points: [
      "Official Google GenAI SDK: Integrates gemini-3.8-flash with automatic failover to gemini-4-hydrogen.",
      "4-Point Physical Installation QC: Evaluates physical safety beyond simple digit extraction: Wire Safety, Terminal Cover, Tamper Seal, Casing Integrity.",
      "Reconciliation Logic: If Edge OCR was unreadable, VLM automatically reconciles kWh. If discrepancy > 1.0 kWh, flags MISMATCH_FLAGGED for human supervisor review.",
      "Structured Strict JSON: Enforces deterministic JSON output parsing with confidence scores, semantic tags, and diagnostic notes."
    ],
    metrics: [
      { label: "Primary Model", value: "gemini-3.8-flash", desc: "High-speed multimodal VLM", color: "text-blue-600" },
      { label: "Fallback Model", value: "gemini-4-hydrogen", desc: "Long-decode agentic model", color: "text-teal-600" },
      { label: "Mismatch Tolerance", value: "±1.0 kWh", desc: "Auto-reconciliation threshold", color: "text-amber-600" }
    ],
    notes: {
      keyTakeaway: "The cloud VLM acts as an automated senior quality inspector auditing every physical installation.",
      talkingPoints: [
        "Tier 3 is what makes NOVO enterprise-ready. When cellular connectivity is restored, the full-res photo uploads to FastAPI.",
        "The server invokes Gemini 3.8 Flash to run a 4-point physical scorecard: checking whether the terminal cover is seated, tamper seal is unbroken, casing is undamaged, and wires are hazard-free.",
        "If Edge and VLM agree, it marks VLM_VERIFIED. If they disagree, it marks MISMATCH_FLAGGED for supervisor review."
      ],
      examinerQuestions: [
        {
          question: "Why use both gemini-3.8-flash and gemini-4-hydrogen?",
          answer: "Gemini 3.8 Flash provides fast, cost-effective multimodal extraction for standard photos. If the primary API experiences rate limits or server timeouts, the fallback to Gemini 4 Hydrogen ensures zero loss of audit telemetry."
        }
      ]
    }
  },
  {
    id: "evidence-seal",
    category: "Regulatory Compliance",
    title: "Cryptographic SHA-256 Evidence Sealing",
    subtitle: "Tamper-evident chain of custody for legal and regulatory DISCOM audits",
    asciiType: "discom",
    points: [
      "Synchronous Cryptographic Sealing: Computed immediately upon image upload inside FastAPI before background tasks execute.",
      "Immutable Digest Tuple: evidence_sha256 = sha256(file_bytes + meter_serial_number + timestamp_utc).",
      "Legal Non-Repudiation: Any modification to the image pixels, serial number, or timestamp invalidates the 64-character hex seal.",
      "Regulatory Chain of Custody: Stored in Supabase PostgreSQL and exported to compliance spreadsheets for state electricity regulatory commissions."
    ],
    notes: {
      keyTakeaway: "SHA-256 evidence digests guarantee that field photos cannot be forged, manipulated, or re-used.",
      talkingPoints: [
        "In utility litigation and electricity theft cases, photos taken by contractors are often contested in court as doctored.",
        "NOVO implements synchronous cryptographic evidence sealing upon image receipt.",
        "By hashing the raw photo bytes concatenated with the meter serial and UTC timestamp, we provide an immutable tamper seal."
      ],
      examinerQuestions: [
        {
          question: "Could someone tamper with the image before upload?",
          answer: "The mobile app saves the raw capture directly into encrypted app sandbox storage and immediately commits the timestamp and GPS to SQLite WAL before generating the upload payload."
        }
      ]
    }
  },
  {
    id: "fleet-map",
    category: "Real-Time Operations",
    title: "Live Devices Fleet Map & 2-Way Idempotent Messaging",
    subtitle: "Sub-second bidirectional command and control over WebSocket with persistent offline fallback",
    points: [
      "Real-Time Device Presence: Dynamic WebSocket manager (ws:// and wss://) tracking connected devices with green pulse markers.",
      "Single-Delivery Idempotency ('Only One, Not Both'): Direct alerts push in sub-second time over WebSocket if online, falling back to HTTP polling if offline, with INSERT OR IGNORE SQLite de-duplication.",
      "Technician Reply Dialogue: Technicians submit actionable field notes (e.g. 'Substation isolated') alongside their ACTIONED acknowledgment.",
      "Interactive Fleet Leaflet Map: Displays real-time GPS locations, battery percentages, hardware models, and one-click alert dispatch."
    ],
    metrics: [
      { label: "Alert Dispatch Latency", value: "< 250 ms", desc: "Real-time WebSocket push", color: "text-emerald-600" },
      { label: "Delivery Guarantee", value: "Exactly-Once", desc: "Idempotent SQLite de-duplication", color: "text-blue-600" },
      { label: "GPS Tracking", value: "Real-Time / Last Known", desc: "With indoor coordinate fallback", color: "text-slate-600" }
    ],
    notes: {
      keyTakeaway: "Supervisors maintain complete operational visibility and instant two-way communication with field crews.",
      talkingPoints: [
        "The fourth pillar of NOVO is the Live Ops Center on /admin.",
        "It features an interactive Leaflet fleet map tracking technician GPS positions, battery status, and online presence.",
        "Supervisors can dispatch direct safety directives to any technician, which appear instantly on their HUD.",
        "Technicians can reply directly from the alert dialog, updating the supervisor's outbox in real time."
      ],
      examinerQuestions: [
        {
          question: "How do you prevent duplicate alerts if the phone reconnects repeatedly?",
          answer: "We implement dual idempotency: the server enforces a unique constraint on (message_id, device_id, status), and the mobile client uses 'INSERT OR IGNORE INTO client_messages' keyed on message UUID."
        }
      ]
    }
  },
  {
    id: "benchmarks",
    category: "Empirical Results",
    title: "Verified System Benchmarks & DISCOM Specifications",
    subtitle: "Empirically measured performance metrics on physical target hardware",
    points: [
      "Quantized Model Size: 1.24 MB (mobilenetv3_wire_int8.tflite) bundled directly into APK assets.",
      "Stage 1 CPU Latency: 24.34 ms mean on physical device (< 250 ms real-time ceiling).",
      "Peak Heap RAM Consumption: 4.59 MB (< 35 MB Android low-memory budget).",
      "Hazard Detection & Lockout: 95.2% detection accuracy with 100% lockout enforcement on detected hazards.",
      "Tier-1 Cellular Telemetry: < 2 KB per 15-record batch payload (100% point-of-work verification vs 10–20% IS 2500 sampling)."
    ],
    metrics: [
      { label: "Edge Model Size", value: "1.24 MB", desc: "MobileNetV3 INT8 binary", color: "text-blue-600" },
      { label: "Stage 1 Latency", value: "24.34 ms", desc: "Physical edge CPU mean", color: "text-emerald-600" },
      { label: "Peak Heap RAM", value: "4.59 MB", desc: "Against 35 MB threshold", color: "text-indigo-600" },
      { label: "Lockout Rate", value: "100%", desc: "Enforcement on detected hazards", color: "text-red-600" },
      { label: "Batch Payload", value: "< 2 KB", desc: "15 inspection records", color: "text-teal-600" },
      { label: "Audit Coverage", value: "100%", desc: "vs 10-20% IS 2500 lot sampling", color: "text-purple-600" }
    ],
    notes: {
      keyTakeaway: "NOVO meets and exceeds all embedded performance constraints for production utility rollouts.",
      talkingPoints: [
        "Slide 9 presents our empirically verified benchmarks measured directly on the Android hardware.",
        "Our quantized MobileNetV3 model is only 1.24 MB, executing in a blazing 24.34 ms with just 4.59 MB peak RAM.",
        "We achieved 95.2% hazard detection accuracy and 100% safety lockout enforcement.",
        "Telemetry batches take less than 2 KB, allowing seamless operation over weak 2G cellular networks."
      ],
      examinerQuestions: [
        {
          question: "How did you measure the 4.59 MB RAM footprint?",
          answer: "Using Android Studio Memory Profiler and React Native Performance Monitor, measuring delta heap before and after TFLite model allocation and ML Kit text recognition execution."
        }
      ]
    }
  },
  {
    id: "conclusion",
    category: "Conclusion & Viva Defense",
    title: "Conclusion & Viva Defense Summary",
    subtitle: "A complete, production-ready Edge-AI platform for modern power distribution",
    points: [
      "Key Contributions: Real-time safety interlock, exact reticle cropping, 3-tier offline sync, and multimodal VLM audit scorecards.",
      "Production Deployment: Render cloud gateway, Supabase PostgreSQL, and standalone release APK running on target Android devices.",
      "Compliance: Generates 17-column DISCOM Installation QC Audit CSV with cryptographic SHA-256 evidence digests.",
      "Live Demonstration: Ready to walk through the 4-step live demonstration sequence!"
    ],
    notes: {
      keyTakeaway: "NOVO delivers an end-to-end, verified solution bridging edge AI and enterprise cloud utility audits.",
      talkingPoints: [
        "In conclusion, NOVO successfully demonstrates how modern Edge AI, mobile-first engineering, and Vision-Language Models can revolutionize electrical utility infrastructure.",
        "We have deployed the full system live to Render and Supabase, and compiled the standalone release APK onto our phone.",
        "I am now ready to run through the 4-step live demo loop. Thank you, and I look forward to your questions."
      ],
      examinerQuestions: [
        {
          question: "What are your immediate next steps for production rollout?",
          answer: "Integration with utility ERP/MDM systems (such as SAP IS-U or Oracle CC&B) via standard CIM (Common Information Model) APIs, and expanding the TFLite classifier to identify solar net-meter wiring configurations."
        }
      ]
    }
  }
];
