# Novo

Offline-first smart meter inspection and edge quality assurance application for field technicians, built with Expo SDK 57, React Native, and local SQLite persistence.

## Architecture

```mermaid
graph TD
    subgraph UI ["Presentation Layer (Expo Router)"]
        Layout["Root Layout (_layout.tsx)"]
        Dashboard["Dashboard Screen (index.tsx)"]
        Capture["Capture Viewfinder (capture.tsx)"]
        Validation["QA Validation Screen (validation.tsx)"]
    end

    subgraph Design ["Design System"]
        Theme["Tokens (theme.ts)"]
        ThemeHook["useTheme Hook (use-theme.tsx)"]
        ThemedUI["ThemedText / ThemedView"]
    end

    subgraph Services ["Service Layer"]
        Leveling["Accelerometer Leveling (leveling.ts)"]
        Sync["Tier-1 Cellular Sync (tier1-sync.ts)"]
    end

    subgraph Core ["Core Persistence & Models"]
        Repo["Inspection Repository (repository.ts)"]
        Client["SQLite Database Client (client.ts)"]
        Schema["DDL Schema & WAL Mode (schema.ts)"]
        Types["Domain Types (inspection.ts)"]
        Logger["Structured Logger (logger/index.ts)"]
    end

    Layout --> Client
    Dashboard --> Repo
    Dashboard --> Sync
    Capture --> Leveling
    Validation --> Repo
    Sync --> Repo
    Repo --> Client
    Client --> Schema
    Dashboard --> ThemedUI
    Validation --> ThemedUI
    ThemedUI --> ThemeHook
    ThemeHook --> Theme
```

## Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor Tech as Technician
    participant Dash as Dashboard (index.tsx)
    participant Cam as Capture Screen (capture.tsx)
    participant Sensor as Accelerometer (leveling.ts)
    participant Val as Validation (validation.tsx)
    participant DB as SQLite SSOT (repository.ts)
    participant GW as Cellular Gateway (tier1-sync.ts)

    Tech->>Dash: Open App
    Dash->>DB: Query metrics & shift records
    DB-->>Dash: Display HUD (Pending, Synced, Photos)

    Tech->>Dash: Tap "+ NEW SCAN"
    Dash->>Cam: Open Viewfinder
    loop Every 100ms
        Cam->>Sensor: calculateWallTilt(x, y, z)
        Sensor-->>Cam: TiltEvaluation (tilt angle, isAligned)
        Cam->>Cam: Update HUD guidance (90 deg +/- 10 deg)
    end

    Tech->>Cam: Trigger Capture (enabled when isAligned = true)
    Cam->>Val: Route to Validation with inference parameters

    alt Verdict is CRITICAL_HAZARD
        Val->>Val: Enforce Safety Lockout (commit disabled)
        Tech->>Cam: Return to re-take inspection
    else Verdict is PASS or WARNING
        Tech->>Val: Verify serial number and OCR confidence
        Tech->>Val: Optional manual kWh override
        Tech->>Val: Tap "COMMIT RECORD TO LOCAL SQLITE SSOT"
        Val->>DB: insertInspection() with PENDING sync status
        Val->>Dash: Return to Dashboard
        Dash->>DB: Refresh queue via useFocusEffect
    end

    Tech->>Dash: Tap "DISPATCH TIER-1 BATCH"
    Dash->>GW: POST /api/v1/inspections/batch (up to 15 records)
    alt Dispatch Success
        GW-->>Dash: HTTP 200 OK
        Dash->>DB: resolveTier1Batch(ids, true) -> SYNCED
    else Network Failure
        Dash->>DB: resolveTier1Batch(ids, false) -> Revert to PENDING
    end
```

## Core Modules

- **Local SQLite SSOT** (`src/core/db/`): Configured with WAL journal mode (`PRAGMA journal_mode = WAL`) and crash recovery that resets dangling `SYNCING` records back to `PENDING` on bootstrap. Indexed on sync tier columns.
- **Sensor Leveling** (`src/services/sensor/leveling.ts`): Uses accelerometer vector magnitudes to compute tilt from vertical, enforcing perpendicular alignment within a 10 degree tolerance before capture is unlocked.
- **Tier-1 Batch Sync** (`src/services/sync/tier1-sync.ts`): Prepares and dispatches offline inspection telemetry batches (up to 15 records per payload) to a cellular gateway endpoint.
- **Safety Lockout Enforcement** (`src/app/validation.tsx`): Blocks submission when critical hazards are flagged, requiring field remediation and re-inspection.
- **Shift Dashboard** (`src/app/index.tsx`): Provides real-time queue metrics HUD, serial number lookup, and automated focus re-querying via `useFocusEffect`.

## Getting Started

### Prerequisites

- Node.js (v18+)
- pnpm

### Installation

```bash
pnpm install
```

### Running the App

```bash
# Start Metro bundler
pnpm start

# Run on Android
pnpm android

# Run on iOS
pnpm ios

# Run on Web
pnpm web
```

### Code Quality

```bash
# Biome linter
pnpm lint

# Biome formatter & linter check
pnpm check

# TypeScript type check
npx tsc --noEmit
```
