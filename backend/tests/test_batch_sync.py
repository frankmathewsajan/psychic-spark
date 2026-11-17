# tests/test_batch_sync.py
import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.database import Base, engine
from app.main import app

MOCK_PAYLOAD = {
    "batch_id": "batch_1726918200000",
    "inspections": [
        {
            "id": "ins_1726918195000",
            "technician_id": "TECH_MH_4021",
            "meter_serial_number": "EB4820194",
            "timestamp_utc": "2026-09-20T18:20:00.000Z",
            "geo": [19.0760, 72.8777],
            "qa_status": "PASS",
            "hazard_reason": None,
            "kwh_reading": 1428.5,
            "ocr_confidence": 0.962,
        }
    ],
}


@pytest.fixture(autouse=True)
def setup_and_teardown_db():
    settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    orig_storage = settings.STORAGE_BACKEND
    settings.STORAGE_BACKEND = "local"
    Base.metadata.create_all(bind=engine)
    yield
    settings.STORAGE_BACKEND = orig_storage
    Base.metadata.drop_all(bind=engine)


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.get("/api/v1/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ONLINE"
        assert data["database"] == "CONNECTED"


@pytest.mark.asyncio
async def test_tier1_batch_ingest_and_idempotency():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # First submission
        res1 = await client.post("/api/v1/inspections/batch", json=MOCK_PAYLOAD)
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["status"] == "SUCCESS"
        assert data1["ingested_count"] == 1

        # Identical retransmission (idempotency check)
        res2 = await client.post("/api/v1/inspections/batch", json=MOCK_PAYLOAD)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["status"] == "SUCCESS"
        assert data2["ingested_count"] == 1


@pytest.mark.asyncio
async def test_tier2_image_multi_type_upload():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Pre-seed inspection
        await client.post("/api/v1/inspections/batch", json=MOCK_PAYLOAD)

        # 1. Upload CASING image
        casing_content = b"\xff\xd8\xff\xe0MockJPEGBinary1"
        casing_file = ("casing.jpg", casing_content, "image/jpeg")
        res_casing = await client.post(
            "/api/v1/inspections/ins_1726918195000/image",
            data={"photo_type": "CASING"},
            files={"file": casing_file},
        )
        assert res_casing.status_code == 200
        casing_path = res_casing.json()["path"]
        assert casing_path == "/storage/audit_images/ins_1726918195000_CASING.jpg"

        # Verify static file serving endpoint
        res_static = await client.get(casing_path)
        assert res_static.status_code == 200
        assert res_static.content == casing_content

        # 2. Upload DISPLAY image (asserting no overwrite)
        display_content = b"\xff\xd8\xff\xe0MockJPEGBinary2"
        display_file = ("display.jpg", display_content, "image/jpeg")
        res_display = await client.post(
            "/api/v1/inspections/ins_1726918195000/image",
            data={"photo_type": "DISPLAY"},
            files={"file": display_file},
        )
        assert res_display.status_code == 200
        display_path = res_display.json()["path"]
        assert display_path == "/storage/audit_images/ins_1726918195000_DISPLAY.jpg"

        # Verify second static file serving endpoint
        res_static_display = await client.get(display_path)
        assert res_static_display.status_code == 200
        assert res_static_display.content == display_content


@pytest.mark.asyncio
async def test_tier2_image_supabase_storage_upload(monkeypatch):
    import httpx

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        await client.post("/api/v1/inspections/batch", json=MOCK_PAYLOAD)

        monkeypatch.setattr(settings, "STORAGE_BACKEND", "supabase")
        monkeypatch.setattr(settings, "SUPABASE_URL", "https://bxnbeatlldxurigjphml.supabase.co")
        monkeypatch.setattr(settings, "SUPABASE_KEY", "mock-key")
        monkeypatch.setattr(settings, "SUPABASE_BUCKET", "audit-images")

        class MockResponse:
            status_code = 200
            text = '{"Key": "audit-images/ins_1726918195000_TERMINAL_COVER.jpg"}'

        def mock_post(self, url, *args, **kwargs):
            return MockResponse()

        monkeypatch.setattr(httpx.Client, "post", mock_post)

        file_content = b"\xff\xd8\xff\xe0MockSupabaseBinary"
        file = ("terminal.jpg", file_content, "image/jpeg")
        res = await client.post(
            "/api/v1/inspections/ins_1726918195000/image",
            data={"photo_type": "TERMINAL_COVER"},
            files={"file": file},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "STORED"
        assert data["photo_type"] == "TERMINAL_COVER"
        assert data["path"] == (
            "https://bxnbeatlldxurigjphml.supabase.co/storage/v1/object/public/audit-images/ins_1726918195000_TERMINAL_COVER.jpg"
        )


@pytest.mark.asyncio
async def test_admin_dashboard_and_list_inspections():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Ingest a record first
        res_ingest = await client.post("/api/v1/inspections/batch", json=MOCK_PAYLOAD)
        assert res_ingest.status_code == 200

        # Verify admin dashboard HTML
        res_admin = await client.get("/admin")
        assert res_admin.status_code == 200
        assert "text/html" in res_admin.headers["content-type"]
        assert "Novo Admin" in res_admin.text

        # Verify inspections listing endpoint
        res_list = await client.get("/api/v1/inspections")
        assert res_list.status_code == 200
        inspections = res_list.json()
        assert len(inspections) == 1
        assert inspections[0]["id"] == "ins_1726918195000"
        assert inspections[0]["meter_serial_number"] == "EB4820194"
        assert isinstance(inspections[0]["photos"], list)


