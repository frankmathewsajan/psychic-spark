# VIT-AP UNIVERSITY — SCHOOL OF COMPUTER SCIENCE AND ENGINEERING (SCOPE)
## Capstone Project Weekly Progress Diary (Weeks 01 to 13)

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

**Tasks Completed:**  
Analyzed field network limitations for remote utility meter installations and outdoor distribution pillars. Pivoted system design from a cloud-dependent architecture to a hybrid edge-cloud computing model. Researched lightweight convolutional neural networks (MobileNet, TFLite) for on-device inference and Optical Character Recognition (OCR).

**Tasks Planned Next Week:**  
Finalize system architecture, draft the telemetry JSON payload schema, and construct the system architecture flowchart.

**Comments / Suggestion by the Guide:**  
Good focus on real-world cellular constraints. Ensure the local edge pipeline remains viable on entry-level Android hardware.

---

### Week 02: Pipeline Specification & First Review
- **Week Number:** 02
- **Period From:** August 11, 2026
- **Period To:** August 17, 2026
- **Date of Meeting:** August 14, 2026
- **Members Attended:** 23BCE8713

**Tasks Completed:**  
Designed the offline store-and-forward data pipeline specification to handle intermittent cellular connectivity. Drafted the telemetry JSON payload schema and built the comprehensive system architecture flowchart detailing the edge device boundary, local SQLite cache, and FastAPI cloud gateway integration. Presented Capstone First Review covering problem definition, literature survey, and proposed methodology.

**Tasks Planned Next Week:**  
Initialize the mobile client application using React Native and Expo; establish the local SQLite schema with Write-Ahead Logging.

**Comments / Suggestion by the Guide:**  
Discarding cloud-dependent designs due to field latency constraints is justified. Proceed with setting up the offline-first SQLite database.

---

### Week 03: Mobile Framework Setup & Offline Database Engine
- **Week Number:** 03
- **Period From:** August 18, 2026
- **Period To:** August 24, 2026
- **Date of Meeting:** August 21, 2026
- **Members Attended:** 23BCE8713

**Tasks Completed:**  
Initialized the cross-platform mobile client architecture using React Native, TypeScript, and Expo. Defined the local SQLite schema with Write-Ahead Logging (PRAGMA journal_mode = WAL) as the local Single Source of Truth (SSOT). Enabled SQLite foreign key enforcement and created indexes for synchronization and inference queues. Built the repository layer to support local inspection creation and crash-resilient offline persistence.

**Tasks Planned Next Week:**  
Program device accelerometer sensor math to measure camera tilt and gate the capture viewfinder.

**Comments / Suggestion by the Guide:**  
WAL mode is critical for preventing write locks during background processing. Keep the schema decoupled from cloud-specific IDs.

---

### Week 04: Viewfinder Tilt Interlock & Reticle Geometry
- **Week Number:** 04
- **Period From:** August 25, 2026
- **Period To:** August 31, 2026
- **Date of Meeting:** August 28, 2026
- **Members Attended:** 23BCE8713

**Tasks Completed:**  
Programmed the vertical wall-leveling vector formula using Math.hypot(x, y) to evaluate camera perpendicularity. Implemented an active capture interlock that restricts image acquisition when camera tilt exceeds plus-minus 10 degrees. Designed high-contrast on-screen bounding reticles for the overall meter casing, 7-segment display, and terminal seals.

**Tasks Planned Next Week:**  
Build the edge validation review screen and implement the physical hazard lockout decision logic.

**Comments / Suggestion by the Guide:**  
Gating image capture by physical tilt prevents severe glare on curved meter covers. Ensure visual HUD feedback is clear.

---

### Week 05: Edge Validation Screen & Hazard Lockout Modal
- **Week Number:** 05
- **Period From:** September 01, 2026
- **Period To:** September 07, 2026
- **Date of Meeting:** September 04, 2026
- **Members Attended:** 23BCE8713

**Tasks Completed:**  
Built the point-of-work visual validation screen featuring editable kWh inputs and confidence indicators. Implemented an un-dismissible safety lockout modal for critical hazards (exposed wiring, loose phase conductors, broken seals). Added startup recovery pragmas in SQLite to automatically reset orphaned SYNCING states back to PENDING.

**Tasks Planned Next Week:**  
Implement the client-side Tier 1 cellular synchronization service to dispatch sub-2 KB metadata payloads.

**Comments / Suggestion by the Guide:**  
Safety lockouts must be strictly non-bypassable to protect field personnel. Good inclusion of startup orphan recovery.

---

### Week 06: Tier-1 Cellular Dispatch & Static Analysis
- **Week Number:** 06
- **Period From:** September 08, 2026
- **Period To:** September 14, 2026
- **Date of Meeting:** September 11, 2026
- **Members Attended:** 23BCE8713

**Tasks Completed:**  
Developed the Tier-1 background synchronization service to dispatch sub-2 KB JSON batches over cellular links. Configured Biome v2 for high-speed static analysis, resolving all client-side TypeScript warnings and formatting inconsistencies. Implemented network timeout handlers and exponential backoff retry logic for mobile data dropouts.

**Tasks Planned Next Week:**  
Design the cloud ingestion gateway using FastAPI, SQLAlchemy 2.0, and Pydantic validation schemas.

**Comments / Suggestion by the Guide:**  
Sub-2 KB payloads will reliably transmit even on degraded 2G links. Proceed with implementing the backend gateway.

---

### Week 07: FastAPI Cloud Gateway & Storage Layer
- **Week Number:** 07
- **Period From:** September 15, 2026
- **Period To:** September 21, 2026
- **Date of Meeting:** September 18, 2026
- **Members Attended:** 23BCE8713

**Tasks Completed:**  
Built the FastAPI cloud gateway with endpoints for Tier-1 telemetry batches and Tier-2 multipart image uploads. Integrated PostgreSQL with SQLAlchemy 2.0 declarative models and Pydantic validation schemas. Connected Supabase storage (audit-images bucket) with a decoupled inspection_photos table to prevent evidence overwriting.

**Tasks Planned Next Week:**  
Implement conflict-safe idempotency on ingestion, run edge quantization benchmarks, and write integration tests.

**Comments / Suggestion by the Guide:**  
Decoupling image assets into a dedicated table ensures clean multi-angle support. Ensure duplicate network requests are absorbed safely.

---

### Week 08: Idempotency, INT8 Benchmark & Review 2
- **Week Number:** 08
- **Period From:** September 22, 2026
- **Period To:** September 28, 2026
- **Date of Meeting:** September 25, 2026
- **Members Attended:** 23BCE8713

**Tasks Completed:**  
Implemented update-on-conflict idempotency logic in FastAPI to absorb cellular retries without raising HTTP 409 errors. Benchmarked single-threaded INT8 MobileNetV3 inference, verifying 24.34 ms latency and 4.59 MB peak RAM. Validated backend test suite using Pytest/HTTPX and prepared presentation slides and documentation for Review 2. Successfully presented Capstone Review 2 covering edge architecture, database synchronization, and inference benchmarks.

**Tasks Planned Next Week:**  
Evaluate edge model performance against mobile memory constraints and analyze optical character recognition accuracy.

**Comments / Suggestion by the Guide:**  
Review 2 progress is solid. Focus on real-world character-level OCR robustness and physical hazard detection under variable ambient conditions.

---

### Week 09: Edge Model Pivot & 7-Segment OCR Automaton
- **Week Number:** 09
- **Period From:** September 29, 2026
- **Period To:** October 05, 2026
- **Date of Meeting:** October 03, 2026
- **Members Attended:** 23BCE8713

**Tasks Completed:**  
Evaluated a two-stage YOLOv8 ONNX WebAssembly pipeline inside an off-screen mobile WebView, identifying severe thermal and latency bottlenecks (1,240 ms latency, 185 MB peak RAM). Pivoted to a native INT8-quantized MobileNetV3 classifier (1.24 MB, 24.34 ms) for terminal wire safety paired with Google ML Kit text recognition for digits. Formulated the edge physical hazard lockout decision logic to detect exposed wiring and uninsulated phase conductors. Engineered a 7-segment token sanitization automaton and height-ratio decimal recovery rule (r < 0.82), reducing Character Error Rate from 24.8% to 1.2% with 0.0% silent hallucinations.

**Tasks Planned Next Week:**  
Build a dedicated point-of-work visual verification screen and implement an unconstrained polygon cropper to rectify skewed meter displays.

**Comments / Suggestion by the Guide:**  
Prudent pivot from heavy WebView WASM to native INT8 models. The 50.9x latency reduction ensures the inspection app remains responsive on budget field devices.

---

### Week 10: Point-of-Work Verification Screen & CamScanner Precision Polygon Cropper
- **Week Number:** 10
- **Period From:** October 06, 2026
- **Period To:** October 12, 2026
- **Date of Meeting:** October 10, 2026
- **Members Attended:** 23BCE8713

**Tasks Completed:**  
Optimized camera capture by invoking takePictureAsync with skipProcessing: true, achieving a sub-250 ms perceived shutter commit without blocking the JavaScript thread. Built the Intermediary Verification Screen (inspect-preview.tsx) uniting Step A (MobileNetV3 wire safety evaluation) and Step B (cropped LCD reading sign-off). Developed a CamScanner-style 4-point polygon cropper with a 2.8x magnifying loupe (85 px above touch), 2x canvas zoom, and affine de-skewing to counter-rotate oblique meter bezels. Redesigned crop actions into a sleek unified segmented pill bar (Adjust / Re-check) with clean SVG icons, zero emojis, and active loading feedback.

**Tasks Planned Next Week:**  
Develop the cloud-tier multimodal Vision-Language Model (VLM) for autonomous physical installation verification and implement cryptographic evidence sealing.

**Comments / Suggestion by the Guide:**  
The magnifying loupe and affine de-skewing provide practical ergonomics for tight distribution boxes. Proceed with developing the cloud verification layer.

---

### Week 11: Cloud Multimodal VLM Quality Audit & Reading Reconciliation
- **Week Number:** 11
- **Period From:** October 13, 2026
- **Period To:** October 19, 2026
- **Date of Meeting:** October 17, 2026
- **Members Attended:** 23BCE8713

**Tasks Completed:**  
Integrated Google Gemini foundation models (gemini-3.8-flash with fallback to gemini-4-hydrogen) into the FastAPI cloud gateway as an asynchronous auditor. Formulated a 4-point physical QC evaluation checklist covering wire flushness, terminal cover seating, tamper seal presence, and casing integrity. Implemented edge-cloud reading reconciliation with a +/- 1.0 kWh tolerance threshold, automatically routing flagged deviations to supervisor review. Programmed an automated SHA-256 evidence sealing engine computing cryptographic digests over photo bytes, serial, timestamp, and GPS, and attached hardware attribution telemetry (device_id, device_model, app_version) to every record.

**Tasks Planned Next Week:**  
Implement non-blocking two-tier synchronization, enable cloud disaster recovery sync-back, and build two-way administrative directives.

**Comments / Suggestion by the Guide:**  
The automated 4-point checklist and cryptographic digests provide the non-repudiation required for regulatory reporting. Focus next on mobile sync resilience.

---

### Week 12: Non-Blocking Sync UX, Cloud Disaster Recovery & Two-Way Directives
- **Week Number:** 12
- **Period From:** October 20, 2026
- **Period To:** October 26, 2026
- **Date of Meeting:** October 24, 2026
- **Members Attended:** 23BCE8713

**Tasks Completed:**  
Decoupled two-tier synchronization so immediate Tier-1 metadata commit (< 1s) releases the UI instantly while heavy Tier-2 casing photos stream non-blockingly in the background. Implemented SQLite live migration 2c adding evidence_sha256 to the inspections table, enabling seamless cloud disaster recovery and sync-back without schema warnings. Constructed a two-way administrative messaging engine supporting BROADCAST, DEVICE, and TECHNICIAN targeting with local SQLite persistence for offline reception. Added closed-loop WebSocket delivery and action acknowledgment tracking (DELIVERED, ACTIONED) with technician reply notes reflected in the admin dashboard in under 95 ms.

**Tasks Planned Next Week:**  
Integrate a 3D Mapbox digital twin in the admin portal for multi-floor facility monitoring, build a fleet simulator, and prepare final Capstone defense deliverables.

**Comments / Suggestion by the Guide:**  
Decoupling media upload from point-of-work interactions prevents field workflow interruptions. The clean schema migration ensures reliable disaster recovery.

---

### Week 13: 3D Mapbox Digital Twin, Fleet Simulation & Final Capstone Defense
- **Week Number:** 13
- **Period From:** October 27, 2026
- **Period To:** November 02, 2026
- **Date of Meeting:** October 31, 2026
- **Members Attended:** 23BCE8713

**Tasks Completed:**  
Integrated a 3D Mapbox GL JS v3 digital twin into the admin console with a dual view switcher (2D Classic / Modern 3D View) and auto-panning 360-degree camera orbit. Added dynamic environmental lighting synchronized with Dark (night), Slate (dusk), and Light (day) themes. Modeled the multi-story Ahmedabad Substation Depot with 3D polygon extrusions (Levels L0-L3) and an interactive floor filter HUD. Built an in-memory 8-agent virtual fleet simulation with multi-floor movement, live status popups, and zero database writes. Finalized all Capstone academic deliverables: 7-chapter Overleaf thesis report, 16-slide presentation deck, streaming DISCOM CSV exports, and complete 13-week project diary.

**Tasks Planned Next Week:**  
Defend the Capstone Final Viva Review and submit the bound project thesis report along with the digital media repository.

**Comments / Suggestion by the Guide:**  
Outstanding engineering achievement. The combination of native edge ML, CamScanner-style precision cropping, decoupled cloud resilience, and 3D digital twin fleet monitoring demonstrates exceptional technical and operational maturity.
