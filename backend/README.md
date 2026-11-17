# Novo Ingestion Gateway Backend

FastAPI ingestion gateway for smart meter inspections, telemetry syncing, audit photo storage, and Tier-3 Cloud VLM Second-Verification.

## Deployment on Render

1. Create a new **Web Service** on [Render](https://dashboard.render.com).
2. Configure settings:
   - **Environment:** `Python 3`
   - **Root Directory:** `backend/`
   - **Build Command:** `uv sync`
   - **Start Command:** `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1`
   - **Instance Type:** Free (0.1 CPU, 512 MB RAM)
3. Add **Environment Variables** (see `render.env.example`):
   - `DATABASE_URL`: `postgresql://postgres.bxnbeatlldxurigjphml:<PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres` (Supabase IPv4 Session Pooler)
   - `STORAGE_BACKEND`: `supabase` (or `local`)
   - `SUPABASE_URL`: `https://bxnbeatlldxurigjphml.supabase.co`
   - `SUPABASE_KEY`: `<SUPABASE_ANON_OR_SERVICE_KEY>`
   - `SUPABASE_BUCKET`: `audit-images`
   - `GEMINI_API_KEY`: `<GEMINI_API_KEY>` (Uses `gemini-3.8-flash` primary, `gemini-4-hydrogen` fallback)

## Web Admin Dashboard

The backend includes a zero-build live admin console available at:
```
http://<host>:8000/admin
```
Features:
- Real-time auto-polling every 5 seconds.
- Metric counters: Total, Verified, Warnings, and Critical Hazards.
- Two-stage acknowledgment status: `Received (VLM Pending)` vs `VLM Verified` vs `Mismatch Flagged`.
- Audit image preview modal with fallback support for ephemeral containers.

## Local Development

```bash
cd backend
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Running Tests

```bash
cd backend
uv run pytest
```

