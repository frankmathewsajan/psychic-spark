# Novo

Offline-first smart meter inspection and edge quality assurance platform. The system comprises an Expo mobile field application with local SQLite persistence and a FastAPI ingestion gateway for cellular telemetry batching and audit photo storage.

## Architecture

```mermaid
graph TD
    subgraph Mobile ["Mobile Client (Expo SDK 57 / React Native)"]
        Layout["Root Layout (_layout.tsx)"]
        Dashboard["Dashboard Screen (index.tsx)"]
        Capture["Capture Viewfinder (capture.tsx)"]
        Validation["QA Validation Screen (validation.tsx)"]
        LocalDB["Local SQLite SSOT (schema.ts, repository.ts)"]
        Sensors["Sensor Leveling Service (leveling.ts)"]
        SyncClient["Tier-1 Batch Sync (tier1-sync.ts)"]
    end

    subgraph Gateway ["Ingestion Gateway (FastAPI Backend)"]
        Router["API Router (router.py)"]
        HealthEndpoint["Health Diagnostics (/api/v1/health)"]
        BatchEndpoint["Batch Ingestion (/api/v1/inspections/batch)"]
        ImageEndpoint["Audit Image Upload (/api/v1/inspections/{id}/image)"]
        ORMLayer["SQLAlchemy Models (Inspection, InspectionPhoto)"]
        Schemas["Pydantic Schemas (Tier1BatchPayload)"]
    end

    subgraph Storage ["Server Persistence"]
        ServerDB[("Backend SQLite DB (inspections.db)")]
        ImageDisk["Audit Photo Storage (/storage/audit_images)"]
    end

    Layout --> LocalDB
    Dashboard --> LocalDB
    Dashboard --> SyncClient
    Capture --> Sensors
    Validation --> LocalDB
    SyncClient -->|HTTP POST Tier-1 Batch| BatchEndpoint
    BatchEndpoint --> Schemas
    BatchEndpoint --> ORMLayer
    ImageEndpoint --> ORMLayer
    ImageEndpoint --> ImageDisk
    HealthEndpoint --> ORMLayer
    ORMLayer --> ServerDB
```

## Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor Tech as Technician
    participant Mobile as Mobile App (Expo)
    participant LocalDB as Local SQLite SSOT
    participant Gateway as FastAPI Ingestion Gateway
    participant ServerDB as Server Database
    participant FileStorage as Audit Photo Storage

    Tech->>Mobile: Launch App
    Mobile->>LocalDB: Read shift metrics and inspection history
    LocalDB-->>Mobile: Display Queue HUD & Shift Records

    Tech->>Mobile: Tap "+ NEW SCAN"
    loop Accelerometer Evaluation (100ms interval)
        Mobile->>Mobile: calculateWallTilt(x, y, z)
        Mobile->>Mobile: Verify perpendicular alignment (90 deg +/- 10 deg)
    end

    Tech->>Mobile: Trigger Capture (unlocked when aligned)
    Mobile->>Mobile: Route to Validation with inference readings

    alt Critical Hazard Detected
        Mobile->>Mobile: Enforce Safety Lockout (Commit disabled)
        Tech->>Mobile: Re-inspect meter terminal cover
    else Status is PASS or WARNING
        Tech->>Mobile: Verify OCR confidence & optional kWh manual override
        Tech->>Mobile: Tap "COMMIT RECORD TO LOCAL SQLITE SSOT"
        Mobile->>LocalDB: insertInspection() with status: PENDING
        Mobile->>LocalDB: Auto-refresh HUD via useFocusEffect
    end

    Tech->>Mobile: Tap "DISPATCH TIER-1 BATCH"
    Mobile->>LocalDB: Transition up to 15 records to SYNCING
    Mobile->>Gateway: POST /api/v1/inspections/batch (Tier1BatchPayload)
    Gateway->>ServerDB: Upsert Inspection records (idempotent)
    ServerDB-->>Gateway: Commit OK
    Gateway-->>Mobile: HTTP 200 OK (BatchIngestResponse)
    Mobile->>LocalDB: Transition records to SYNCED

    opt Tier-2 Photo Upload
        Mobile->>Gateway: POST /api/v1/inspections/{id}/image (photo_type, file)
        Gateway->>FileStorage: Store {id}_{photo_type}.jpg
        Gateway->>ServerDB: Upsert InspectionPhoto record
        ServerDB-->>Gateway: Commit OK
        Gateway-->>Mobile: HTTP 200 OK (ImageUploadResponse)
        Mobile->>LocalDB: Transition photo status to SYNCED
    end
```

## System Components

### Mobile Client (`src/`)
- **Local SQLite SSOT** (`src/core/db/`): Configured with WAL journal mode (`PRAGMA journal_mode = WAL`) and crash recovery resetting uncommitted `SYNCING` records back to `PENDING` on startup.
- **Sensor Leveling** (`src/services/sensor/leveling.ts`): Uses accelerometer vector magnitudes to compute tilt from vertical, enforcing perpendicular alignment within 10 degrees before capture unlocks.
- **Tier-1 Batch Sync** (`src/services/sync/tier1-sync.ts`): Dispatches offline inspection telemetry batches (up to 15 records per payload) to the gateway endpoint.
- **Safety Lockout Enforcement** (`src/app/validation.tsx`): Blocks submission when critical hazards are detected, requiring field remediation.
- **Shift Dashboard** (`src/app/index.tsx`): Displays real-time offline queue metrics HUD, meter search, and automated focus re-querying via `useFocusEffect`.

### Ingestion Gateway (`backend/`)
- **FastAPI Application** (`backend/app/main.py`): Asynchronous gateway with CORS middleware, lifespan database bootstrapping, and structured API routing under `/api/v1`.
- **Telemetry Batch Ingestion** (`backend/app/api/v1/inspections.py`): Endpoint `/api/v1/inspections/batch` accepting `Tier1BatchPayload` with idempotent upsert logic.
- **Audit Image Upload** (`backend/app/api/v1/inspections.py`): Endpoint `/api/v1/inspections/{inspection_id}/image` accepting multipart form data for photo types (`CASING`, `TERMINAL_COVER`, `DISPLAY`, `TAMPER_SEAL`) persisted to `storage/audit_images/`.
- **Database Layer** (`backend/app/core/database.py`, `backend/app/models/inspection.py`): SQLAlchemy models with cascading foreign keys and unique constraints per photo type.
- **Diagnostics** (`backend/app/api/v1/health.py`): Endpoint `/api/v1/health` providing database connectivity checks with HTTP 503 degraded error responses on connection loss.

## Getting Started

### Prerequisites
- Node.js (v18+) and pnpm
- Python (3.14+) and uv (or pip)

### Mobile Application

```bash
# Install dependencies
pnpm install

# Start Metro bundler
pnpm start

# Target platforms
pnpm android
pnpm ios
pnpm web

# Code quality
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

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run test suite
pytest tests

# Linting
ruff check app tests
```
