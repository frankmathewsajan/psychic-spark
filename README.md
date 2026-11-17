# Novo

Offline-first smart meter inspection and edge quality assurance platform. The system comprises an Expo mobile field application with local SQLite persistence and a FastAPI ingestion gateway for cellular telemetry batching, audit photo storage, Tier-3 asynchronous Cloud Vision-Language Model (VLM) second-verification, and two-way administrative field messaging with idempotent acknowledgments.

## Architecture

```mermaid
graph TD
    subgraph Mobile ["Mobile Client (Expo SDK 58 / React Native 0.88)"]
        Layout["Root Layout (_layout.tsx)"]
        Dashboard["Dashboard Screen (index.tsx)"]
        Capture["Capture Viewfinder (capture.tsx)"]
        Validation["QA Validation Screen (validation.tsx)"]
        LocalDB["Local SQLite SSOT (schema.ts, repository.ts)"]
        Sensors["Sensor Leveling Service (leveling.ts)"]
        SyncClient["Tier-1 Batch Sync (tier1-sync.ts)"]
        MsgClient["Client Messaging & ACK Flush (tier1-sync.ts)"]
    end

    subgraph Gateway ["Ingestion Gateway (FastAPI Backend)"]
        Router["API Router (router.py)"]
        HealthEndpoint["Health Diagnostics (/api/v1/health)"]
        BatchEndpoint["Batch Ingestion (/api/v1/inspections/batch)"]
        ImageEndpoint["Audit Image Upload (/api/v1/inspections/{id}/image)"]
        MsgEndpoint["2-Way Messaging & ACKs (/api/v1/admin/messages, /devices)"]
        VLMService["Tier-3 Cloud VLM Auditor (vlm_auditor.py)"]
        ORMLayer["SQLAlchemy Models (Inspection, InspectionPhoto, Message)"]
        Schemas["Pydantic Schemas (Tier1BatchPayload, AdminMessage)"]
        AdminUI["Ops Center Web Console (GET /admin)"]
    end

    subgraph AICloud ["Multimodal Cloud Inference"]
        GeminiFlash["Primary: gemini-3.8-flash"]
        GeminiHydrogen["Fallback: gemini-4-hydrogen"]
    end

    subgraph Storage ["Server Persistence"]
        ServerDB[("Backend Database (PostgreSQL / SQLite)")]
        ImageDisk["Audit Photo Storage (Supabase S3 / Local Disk)"]
    end

    Layout --> LocalDB
    Dashboard --> LocalDB
    Dashboard --> SyncClient
    Dashboard --> MsgClient
    Capture --> Sensors
    Validation --> LocalDB
    SyncClient -->|HTTP POST Tier-1 Batch| BatchEndpoint
    SyncClient -->|HTTP GET/POST Msg & ACKs| MsgEndpoint
    BatchEndpoint --> Schemas
    BatchEndpoint --> ORMLayer
    ImageEndpoint --> ORMLayer
    ImageEndpoint --> ImageDisk
    ImageEndpoint -.->|Async Background Task| VLMService
    VLMService --> GeminiFlash
    GeminiFlash -.->|On Failure| GeminiHydrogen
    VLMService --> ORMLayer
    HealthEndpoint --> ORMLayer
    MsgEndpoint --> ORMLayer
    AdminUI --> ORMLayer
    ORMLayer --> ServerDB
```

## Data Flow & Multi-Tier Verification Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Tech as Technician
    participant Mobile as Mobile App (Expo SDK 58)
    participant LocalDB as Local SQLite SSOT
    participant Gateway as FastAPI Ingestion Gateway
    participant VLM as Tier-3 Gemini VLM Auditor
    participant ServerDB as Cloud Server DB (PostgreSQL)
    participant FileStorage as Audit Photo Storage

    Tech->>Mobile: Launch App (Crash recovery cleans pending states)
    Mobile->>LocalDB: Read shift metrics, messages & inspection history
    LocalDB-->>Mobile: Display Queue HUD, Alerts & Shift Records

    Tech->>Mobile: Tap "+ NEW SCAN"
    loop Accelerometer Evaluation (100ms interval)
        Mobile->>Mobile: calculateWallTilt(x, y, z)
        Mobile->>Mobile: Verify perpendicular alignment (90 deg +/- 10 deg)
    end

    Tech->>Mobile: Trigger Capture (unlocked when aligned)
    Mobile->>Mobile: Stage 1: INT8 MobileNetV3 Wire Hazard Classifier
    alt Critical Hazard Detected (P >= 0.65)
        Mobile->>Mobile: Enforce Safety Lockout (Commit disabled)
        Tech->>Mobile: Re-terminate wiring and re-inspect
    else Safe (P < 0.65)
        Mobile->>Mobile: Stage 2: Central Reticle Crop + ML Kit OCR + Sanitizer
        Mobile->>LocalDB: insertInspection() with status: PENDING
    end

    Tech->>Mobile: Tap "DISPATCH TIER-1 BATCH"
    Mobile->>Gateway: POST /api/v1/inspections/batch (Sub-2 KB JSON telemetry + Device Attribution)
    Gateway->>ServerDB: Upsert Inspection records (idempotent)
    ServerDB-->>Gateway: Commit OK
    Gateway-->>Mobile: HTTP 200 OK (BatchIngestResponse)
    Mobile->>LocalDB: Transition records to SYNCED

    Mobile->>Gateway: GET /api/v1/devices/{device_id}/messages
    Gateway-->>Mobile: Active administrative alerts & directives
    Mobile->>Gateway: POST /devices/{device_id}/messages/{id}/ack (DELIVERED)

    opt Tier-2 Photo Upload & Tier-3 VLM Verification
        Mobile->>Gateway: POST /api/v1/inspections/{id}/image (photo_type, file)
        Gateway->>FileStorage: Store {id}_{photo_type}.jpg
        Gateway->>ServerDB: Upsert InspectionPhoto record
        Gateway->>VLM: Enqueue run_vlm_meter_audit(id, image_bytes)
        Gateway-->>Mobile: HTTP 200 OK (ImageUploadResponse)
        Mobile->>LocalDB: Transition photo status to SYNCED
        
        Note over VLM,ServerDB: Tier-3 Asynchronous Multimodal Audit
        VLM->>VLM: Call gemini-3.8-flash (fallback: gemini-4-hydrogen)
        VLM->>ServerDB: Reconcile Edge vs VLM (VLM_VERIFIED / MISMATCH_FLAGGED)
    end
```

## System Components

### 1. Mobile Client (`src/`)
- **Local SQLite SSOT** (`src/core/db/`): Configured with WAL journal mode (`PRAGMA journal_mode = WAL`), live schema migrations, and automated startup crash recovery resetting interrupted `SYNCING` and `PROCESSING` records.
- **Hardware-Sensor Leveling** (`src/services/sensor/leveling.ts`): Computes handset tilt from vertical normal ($\theta = \arctan(Z / \sqrt{X^2+Y^2}) \times 180/\pi$), locking capture to an angular window of $90^\circ \pm 10^\circ$ ($\theta \le 20^\circ$) to eliminate specular sun glare.
- **Stage 1 INT8 Safety Interlock** (`src/services/inference/meter-inference.ts`): $1.24\text{~MB}$ INT8 quantized MobileNetV3 wire-hazard classifier executing in $24.34\text{~ms}$ on edge CPUs, halting OCR and enforcing job lockout when $P_{\text{hazard}} \ge 0.65$.
- **Stage 2 Sim-to-Real Hybrid OCR**: Reticle cropping paired with a deterministic 7-segment character sanitization lookup automaton and bounding box height-ratio decimal inference, achieving zero silent misreads within a $4.59\text{~MB}$ peak heap footprint.
- **Tier-1 Batch Sync** (`src/services/sync/tier1-sync.ts`): Dispatches offline telemetry batches ($<2\text{~KB}$ per 15 records) with exponential backoff and random jitter.
- **Two-Way Messaging Client**: Polls administrative broadcasts and direct technician alerts, storing them in local SQLite (`client_messages`), and dispatches idempotent acknowledgments (`pending_message_acks`).
- **Shift Dashboard** (`src/app/index.tsx`): Real-time offline queue metrics HUD, administrative directive banners, and runtime gateway configuration.

### 2. Ingestion Gateway & Cloud Infrastructure (`backend/`)
- **FastAPI Asynchronous Gateway** (`backend/app/main.py`): High-throughput ASGI server with CORS middleware, lifespan bootstrapping, and structured `/api/v1` routes.
- **Telemetry Batch Ingestion** (`backend/app/api/v1/inspections.py`): Endpoint `/api/v1/inspections/batch` with full device attribution (`device_id`, `device_model`, `app_version`) and idempotent upsert logic.
- **Audit Image Ingestion** (`backend/app/api/v1/inspections.py`): Endpoint `/api/v1/inspections/{id}/image` accepting multipart forms across `CASING`, `TERMINAL_COVER`, `DISPLAY`, and `TAMPER_SEAL` photo types.
- **Tier-3 Cloud VLM Auditor** (`backend/app/services/vlm_auditor.py`): Asynchronous background verification microservice powered by the official Google GenAI SDK. Dispatches audit frames to `gemini-3.8-flash` with automatic fallback to `gemini-4-hydrogen`, reconciling physical display readings with edge OCR:
  - If edge reading was unreadable but VLM detects cumulative kWh with confidence $\ge 0.70$, automatically reconciles the register.
  - If discrepancy $> 1.0\text{~kWh}$, flags the inspection as `MISMATCH_FLAGGED` for supervisory human review.
- **Two-Way Administrative Messaging** (`backend/app/api/v1/messages.py`): Full dispatch engine supporting `BROADCAST` and targeted `DEVICE`/`TECHNICIAN` messages with priority tiers (`LOW`, `NORMAL`, `URGENT`) and idempotent delivery tracking.
- **Live Ops Center Web Console** (`GET /admin`): Integrated zero-build HTML/Tailwind web console featuring real-time inspection feeds, VLM audit tags, photo lightbox modals, and directive dispatching.
- **Database & Storage Layer**: SQLAlchemy models supporting local SQLite for offline development and Supabase PostgreSQL with connection pooling and S3-compatible bucket storage (`audit-images`) for production.
- **Zero-Trust Mesh Overlay**: Supports peer-to-peer WireGuard routing via Tailscale (`100.108.9.95:8000`) for private CGNAT access without public port forwarding.

## Getting Started

### Prerequisites
- Node.js (v18+) and pnpm
- Python (3.12+) and uv (or pip)
- (Optional) Gemini API Key for Tier-3 VLM verification (`GEMINI_API_KEY`)

### Mobile Application

```bash
# Install dependencies
pnpm install

# Start Metro bundler
pnpm start

# Run on Android or iOS
pnpm android
pnpm ios

# Code quality checks
pnpm lint
pnpm check
npx tsc --noEmit
```

### Ingestion Gateway

```bash
cd backend

# Create virtual environment and install dependencies
uv venv
uv pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with GEMINI_API_KEY, SUPABASE_URL, etc.

# Run development server
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Open Admin Ops Center in browser
# http://localhost:8000/admin

# Run test suite
pytest tests
```
