# Novo Ingestion Gateway Backend

FastAPI ingestion gateway for smart meter inspections, telemetry syncing, and audit photo storage.

## Deployment on Render

1. Create a new **Web Service** on [Render](https://dashboard.render.com).
2. Configure settings:
   - **Environment:** `Python 3`
   - **Root Directory:** `backend/`
   - **Build Command:** `uv sync`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1`
   - **Instance Type:** Free (0.1 CPU, 512 MB RAM)
3. Add **Environment Variables** (see `render.env.example`):
   - `DATABASE_URL`: `postgresql://postgres.bxnbeatlldxurigjphml:<PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`
   - `STORAGE_BACKEND`: `supabase`
   - `SUPABASE_URL`: `https://bxnbeatlldxurigjphml.supabase.co`
   - `SUPABASE_KEY`: `<SUPABASE_ANON_OR_SERVICE_KEY>`
   - `SUPABASE_BUCKET`: `audit-images`

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
