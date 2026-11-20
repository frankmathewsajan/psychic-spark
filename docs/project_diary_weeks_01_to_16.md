# VIT-AP UNIVERSITY — SCHOOL OF COMPUTER SCIENCE AND ENGINEERING (SCOPE)
## Capstone Project Weekly Progress Diary (Weeks 01 to 16)

### Project Identification & Guide Details
- **Capstone ID:** CAPSTONE - 4001
- **Project Title:** Hybrid Edge-Cloud Visual Inspection System for Utility Meter Verification
- **Student Name:** Frank Mathew Sajan
- **Registration Number:** 23BCE8713
- **Programme & Specialization:** B.Tech Computer Science and Engineering (AIML)
- **Internal Academic Guide:** Dr. Sibi Chakkaravarthy S, Associate Professor, SCOPE, VIT-AP University
- **External Industry Guide:** Mr. Gowrav Shekar, Head of Technology & AI Practices, Adani AI Labs, Ahmedabad, Gujarat

---

### Week 01: Problem Identification & Architecture Pivot
- **Week Number:** 01
- **Period From:** August 04, 2026
- **Period To:** August 10, 2026
- **Date of Meeting:** August 08, 2026
- **Members Attended:** 23BCE8713

#### Tasks Completed:
1. Analyzed field network limitations across remote utility meter installations and outdoor distribution pillars.
2. Pivoted system design from a cloud-dependent architecture to a hybrid edge-cloud computing model.
3. Researched lightweight convolutional neural networks (MobileNet, TFLite) for on-device inference and Optical Character Recognition (OCR).

#### Tasks Planned Next Week:
Finalize system architecture, draft the telemetry JSON payload schema, and construct the system architecture flowchart.

#### Comments / Suggestion by the Guide:
*Good focus on real-world cellular constraints. Ensure the local edge pipeline remains viable on entry-level Android hardware.*

---

### Week 02: Pipeline Specification & First Review
- **Week Number:** 02
- **Period From:** August 11, 2026
- **Period To:** August 17, 2026
- **Date of Meeting:** August 14, 2026
- **Members Attended:** 23BCE8713

#### Tasks Completed:
1. Designed the offline store-and-forward data pipeline specification to handle intermittent cellular connectivity.
2. Drafted the telemetry JSON payload schema and built the comprehensive system architecture flowchart.
3. Detailed the edge device boundary, local SQLite cache, and FastAPI cloud gateway integration.
4. Presented Capstone First Review covering problem definition, literature survey, and proposed methodology.

#### Tasks Planned Next Week:
Initialize the mobile client application using React Native and Expo; establish the local SQLite schema with Write-Ahead Logging.

#### Comments / Suggestion by the Guide:
*Discarding cloud-dependent designs due to field latency constraints is justified. Proceed with setting up the offline-first SQLite database.*

---

### Week 03: Mobile Framework Setup & Offline Database Engine
- **Week Number:** 03
- **Period From:** August 18, 2026
- **Period To:** August 24, 2026
- **Date of Meeting:** August 21, 2026
- **Members Attended:** 23BCE8713

#### Tasks Completed:
1. Initialized the cross-platform mobile client architecture using React Native, TypeScript, and Expo.
2. Defined the local SQLite schema with Write-Ahead Logging (`PRAGMA journal_mode = WAL`) as the local Single Source of Truth (SSOT).
3. Enabled SQLite foreign key enforcement and created indexes for synchronization and inference queues.
4. Built the repository layer to support local inspection creation and crash-resilient offline persistence.

#### Tasks Planned Next Week:
Program device accelerometer sensor math to measure camera tilt and gate the capture viewfinder.

#### Comments / Suggestion by the Guide:
*WAL mode is critical for preventing write locks during background processing. Keep the schema decoupled from cloud-specific IDs.*

---

### Week 04: Viewfinder Tilt Interlock & Reticle Geometry
- **Week Number:** 04
- **Period From:** August 25, 2026
- **Period To:** August 31, 2026
- **Date of Meeting:** August 28, 2026
- **Members Attended:** 23BCE8713

#### Tasks Completed:
1. Programmed the vertical wall-leveling vector formula using `Math.hypot(x, y)` to evaluate camera perpendicularity.
2. Implemented an active capture interlock that restricts image acquisition when camera tilt exceeds $\pm 10^\circ$.
3. Designed high-contrast on-screen bounding reticles for the overall meter casing, 7-segment display, and terminal seals.

#### Tasks Planned Next Week:
Build the edge validation review screen and implement the physical hazard lockout decision logic.

#### Comments / Suggestion by the Guide:
*Gating image capture by physical tilt prevents severe glare on curved meter covers. Ensure visual HUD feedback is clear.*

---

### Week 05: Edge Validation Screen & Hazard Lockout Modal
- **Week Number:** 05
- **Period From:** September 01, 2026
- **Period To:** September 07, 2026
- **Date of Meeting:** September 04, 2026
- **Members Attended:** 23BCE8713

#### Tasks Completed:
1. Built the point-of-work visual validation screen featuring editable kWh inputs and confidence indicators.
2. Implemented an un-dismissible safety lockout modal for critical hazards (exposed wiring, loose phase conductors, broken seals).
3. Added startup recovery pragmas in SQLite to automatically reset orphaned `SYNCING` states back to `PENDING`.

#### Tasks Planned Next Week:
Implement the client-side Tier 1 cellular synchronization service to dispatch sub-2 KB metadata payloads.

#### Comments / Suggestion by the Guide:
*Safety lockouts must be strictly non-bypassable to protect field personnel. Good inclusion of startup orphan recovery.*

---

### Week 06: Tier-1 Cellular Dispatch & Static Analysis
- **Week Number:** 06
- **Period From:** September 08, 2026
- **Period To:** September 14, 2026
- **Date of Meeting:** September 11, 2026
- **Members Attended:** 23BCE8713

#### Tasks Completed:
1. Developed the Tier-1 background synchronization service to dispatch sub-2 KB JSON batches over cellular links.
2. Configured Biome v2 for high-speed static analysis, resolving all client-side TypeScript warnings and formatting inconsistencies.
3. Implemented network timeout handlers and exponential backoff retry logic for mobile data dropouts.

#### Tasks Planned Next Week:
Design the cloud ingestion gateway using FastAPI, SQLAlchemy 2.0, and Pydantic validation schemas.

#### Comments / Suggestion by the Guide:
*Sub-2 KB payloads will reliably transmit even on degraded 2G links. Proceed with implementing the backend gateway.*

---

### Week 07: FastAPI Cloud Gateway & Storage Layer
- **Week Number:** 07
- **Period From:** September 15, 2026
- **Period To:** September 21, 2026
- **Date of Meeting:** September 18, 2026
- **Members Attended:** 23BCE8713

#### Tasks Completed:
1. Built the FastAPI cloud gateway with endpoints for Tier-1 telemetry batches and Tier-2 multipart image uploads.
2. Integrated PostgreSQL with SQLAlchemy 2.0 declarative models and Pydantic validation schemas.
3. Connected Supabase storage (`audit-images` bucket) with a decoupled `inspection_photos` table to prevent evidence overwriting.

#### Tasks Planned Next Week:
Implement conflict-safe idempotency on ingestion, run edge quantization benchmarks, and write integration tests.

#### Comments / Suggestion by the Guide:
*Decoupling image assets into a dedicated table ensures clean multi-angle support. Ensure duplicate network requests are absorbed safely.*

---

### Week 08: Idempotency, INT8 Benchmark & Review 2
- **Week Number:** 08
- **Period From:** September 22, 2026
- **Period To:** September 28, 2026
- **Date of Meeting:** September 25, 2026
- **Members Attended:** 23BCE8713

#### Tasks Completed:
1. Implemented update-on-conflict idempotency logic in FastAPI to absorb cellular retries without raising HTTP 409 errors.
2. Benchmarked single-threaded INT8 MobileNetV3 inference (verified $24.34\text{ ms}$ latency and $4.59\text{ MB}$ peak RAM).
3. Validated backend test suite using Pytest/HTTPX and prepared presentation slides and documentation for Review 2.
4. Successfully presented Capstone Review 2 covering edge architecture, database synchronization, and inference benchmarks.

#### Tasks Planned Next Week:
Evaluate real-world edge model performance against mobile memory constraints and analyze optical character recognition accuracy.

#### Comments / Suggestion by the Guide:
*Review 2 progress is solid. Focus on real-world character-level OCR robustness and physical hazard detection under variable ambient conditions.*

---

### Week 09: Edge Model Architecture Pivot & Hazard Detection
- **Week Number:** 09
- **Period From:** September 29, 2026
- **Period To:** October 05, 2026
- **Date of Meeting:** October 03, 2026
- **Members Attended:** 23BCE8713

#### Tasks Completed:
1. Evaluated a two-stage YOLOv8 ONNX WebAssembly pipeline (`manu_panel_best_640.onnx` and `liamm_7seg_best_320.onnx`) running inside an off-screen mobile WebView.
2. Conducted an 83-image sim-to-real benchmark revealing severe thermal throttling, $1,240\text{ ms}$ latency, and excessive memory consumption ($185\text{ MB}$ peak RAM).
3. Architected a lightweight production alternative: an INT8-quantized MobileNetV3 wire safety classifier ($1.24\text{ MB}$, $24.34\text{ ms}$) paired with Google ML Kit native text recognition.
4. Formulated the physical hazard lockout logic to detect exposed wiring and uninsulated phase conductors prior to digit extraction.

#### Tasks Planned Next Week:
Implement deterministic 7-segment digit post-processing and eliminate optical misreads caused by broken or faint display segments.

#### Comments / Suggestion by the Guide:
*Prudent pivot from heavy WebView WASM to native INT8 models. The $50.9\times$ latency reduction ensures the inspection app remains responsive on budget field devices.*

---

### Week 10: 7-Segment Digit Sanitization & Decimal Recovery
- **Week Number:** 10
- **Period From:** October 06, 2026
- **Period To:** October 12, 2026
- **Date of Meeting:** October 10, 2026
- **Members Attended:** 23BCE8713

#### Tasks Completed:
1. Engineered a 7-segment token sanitization automaton that strips unit text (`kWh`, `V`, `A`), filters optical glare artifacts, and resolves ambiguous glyphs ('O'/'D' &rarr; '0', 'I'/'l' &rarr; '1', 'S' &rarr; '5', 'B' &rarr; '8').
2. Implemented the deterministic bounding-box height-ratio decimal recovery rule ($r = h_{\text{dot}} / h_{\text{digit}} < 0.82$) to recover broken or faint decimal points reliably.
3. Benchmarked on the 83-image field test set, achieving a drop in Character Error Rate (CER) from 24.8% to 1.2% with 0.0% silent digit hallucinations.

#### Tasks Planned Next Week:
Develop the cloud-tier multimodal Vision-Language Model (VLM) for autonomous physical installation verification and secondary reading cross-checks.

#### Comments / Suggestion by the Guide:
*Deterministic decimal recovery directly addresses regulatory billing disputes. Proceed with integrating the multimodal cloud verification layer.*

---

### Week 11: Cloud Multimodal VLM QC & Reading Reconciliation
- **Week Number:** 11
- **Period From:** October 13, 2026
- **Period To:** October 19, 2026
- **Date of Meeting:** October 17, 2026
- **Members Attended:** 23BCE8713

#### Tasks Completed:
1. Integrated Google Gemini foundation models (`gemini-2.5-flash` with automatic fallback to `gemini-1.5-pro`) into the FastAPI cloud gateway as an asynchronous auditor.
2. Formulated a 4-point physical QC evaluation checklist: (1) Wire safety and conductor flushness, (2) Terminal cover seating, (3) Tamper seal presence, and (4) Enclosure casing integrity.
3. Implemented edge-cloud reading reconciliation with a $\pm 1.0\text{ kWh}$ tolerance threshold; flagged deviations exceeding $1.0\text{ kWh}$ are automatically routed to a supervisor adjudication queue.

#### Tasks Planned Next Week:
Implement cryptographic evidence sealing and tamper-proof hardware attribution to establish legal non-repudiation during audit disputes.

#### Comments / Suggestion by the Guide:
*The automated 4-point checklist standardizes field audit quality. Ensure audit evidence is cryptographically sealed to prevent contractor disputes.*

---

### Week 12: Cryptographic Evidence Sealing & Audit Exports
- **Week Number:** 12
- **Period From:** October 20, 2026
- **Period To:** October 26, 2026
- **Date of Meeting:** October 24, 2026
- **Members Attended:** 23BCE8713

#### Tasks Completed:
1. Programmed an automated SHA-256 evidence sealing engine computing a cryptographic digest: $\text{SHA256}(\text{PhotoBytes} \mathbin{\Vert} \text{Serial} \mathbin{\Vert} \text{Timestamp} \mathbin{\Vert} \text{GPS})$.
2. Embedded hardware attribution telemetry (`device_id`, `device_model`, `app_version`) into every inspection record in PostgreSQL.
3. Built a high-performance streaming API generating official DISCOM regulatory CSVs with embedded evidence digests (1,000 records in $12.4\text{ ms}$; 10,000 records in $182\text{ ms}$).

#### Tasks Planned Next Week:
Build bidirectional communication channels to dispatch urgent safety directives and re-inspection orders from headquarters to field handsets.

#### Comments / Suggestion by the Guide:
*Cryptographic digests provide the non-repudiation required for regulatory reporting. Focus next on enabling real-time headquarters-to-field communication.*

---

### Week 13: Bidirectional Fleet Directives & Field Messaging
- **Week Number:** 13
- **Period From:** October 27, 2026
- **Period To:** November 02, 2026
- **Date of Meeting:** October 31, 2026
- **Members Attended:** 23BCE8713

#### Tasks Completed:
1. Constructed a two-way administrative messaging engine supporting `BROADCAST`, `DEVICE`, and `TECHNICIAN` targeting with priority tiers (`LOW`, `NORMAL`, `URGENT`).
2. Implemented local SQLite persistence (`client_messages`, `pending_message_acks`) allowing technicians to receive directives even when offline in basement meter rooms.
3. Added closed-loop WebSocket delivery and action acknowledgment tracking (`DELIVERED`, `ACTIONED`) with technician reply notes reflected in the admin dashboard in under $95\text{ ms}$.

#### Tasks Planned Next Week:
Eliminate camera shutter lag and build a point-of-work manual polygon adjustment tool for skewed or non-standard meter bezels.

#### Comments / Suggestion by the Guide:
*Bidirectional directives close the loop between central supervision and ground execution. Ensure the point-of-work cropper is ergonomically intuitive.*

---

### Week 14: Zero-Delay Capture & CamScanner-Style Polygon Cropper
- **Week Number:** 14
- **Period From:** November 03, 2026
- **Period To:** November 09, 2026
- **Date of Meeting:** November 07, 2026
- **Members Attended:** 23BCE8713

#### Tasks Completed:
1. Engineered a zero-delay capture flow using `takePictureAsync` with `skipProcessing: true`, achieving $< 250\text{ ms}$ perceived shutter commit without blocking the JavaScript thread.
2. Built the Intermediary Verification Screen (`inspect-preview.tsx`) uniting Step A (MobileNetV3 wire safety evaluation) and Step B (cropped LCD reading sign-off).
3. Developed the CamScanner-style 4-point polygon cropper (`camscanner-cropper-modal.tsx`) with a $2.8\times$ magnifying loupe ($85\text{ px}$ above finger touch), $2\times$ canvas zoom, and affine de-skewing (`cropLcdQuad`).

#### Tasks Planned Next Week:
Refine crop action controls, decouple Tier-2 photo synchronization to unblock the mobile UI, and resolve SQLite cloud restoration schema constraints.

#### Comments / Suggestion by the Guide:
*The magnifying loupe and affine de-skewing provide practical ergonomics for tight distribution boxes. Proceed with unblocking the mobile sync workflow.*

---

### Week 15: Sleek Micro-Actions Bar & Non-Blocking Two-Tier Sync
- **Week Number:** 15
- **Period From:** November 10, 2026
- **Period To:** November 16, 2026
- **Date of Meeting:** November 14, 2026
- **Members Attended:** 23BCE8713

#### Tasks Completed:
1. Redesigned crop actions in `inspect-preview.tsx` into a sleek, unified segmented pill bar (`Adjust` / `Re-check`) with clean SVG icons, zero emojis, and dynamic loading feedback during OCR re-scan.
2. Decoupled two-tier synchronization: immediate Tier-1 metadata commit (< 1s) releases UI interaction instantly, while heavy Tier-2 casing photos stream non-blockingly in the background.
3. Implemented SQLite live migration `2c` adding `evidence_sha256` to the `inspections` table, enabling seamless cloud disaster recovery and sync-back without schema warnings.
4. Updated the administrative dashboard to render technician action reply notes in stylized quote bubbles under directive acknowledgments.

#### Tasks Planned Next Week:
Integrate a 3D Mapbox GL digital twin in the admin portal for multi-floor facility monitoring, build an in-memory fleet simulator, and finalize thesis documentation.

#### Comments / Suggestion by the Guide:
*Decoupling media upload from point-of-work interactions prevents field workflow interruptions. The clean schema migration ensures reliable disaster recovery.*

---

### Week 16: 3D Mapbox Digital Twin, Fleet Simulation & Final Deliverables
- **Week Number:** 16
- **Period From:** November 17, 2026
- **Period To:** November 23, 2026
- **Date of Meeting:** November 20, 2026
- **Members Attended:** 23BCE8713

#### Tasks Completed:
1. Integrated a 3D Mapbox GL JS v3 digital twin into the admin console with a non-breaking view switcher (`2D Classic` / `Modern 3D View`) and auto-panning 360° camera orbit.
2. Added dynamic environmental lighting synchronized with Dark (`night`), Slate (`dusk`), and Light (`day`) themes.
3. Modeled the multi-story Ahmedabad Substation & Fleet Depot with 3D polygon extrusions (Levels L0–L3) and an interactive floor filter HUD.
4. Built an in-memory 8-agent virtual fleet simulation with multi-floor movement, live status popups, and zero database writes.
5. Finalized all Capstone academic deliverables: 7-chapter Overleaf thesis report, 16-slide presentation deck, and complete 16-week project diary.

#### Tasks Planned Next Week:
Defend the Capstone Final Viva Review and submit the bound project thesis report along with the digital media repository.

#### Comments / Suggestion by the Guide:
*Outstanding engineering achievement. The combination of native edge ML, CamScanner-style precision cropping, decoupled cloud resilience, and 3D digital twin fleet monitoring demonstrates exceptional technical and operational maturity.*
