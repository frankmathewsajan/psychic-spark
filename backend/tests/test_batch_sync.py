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
    Base.metadata.create_all(bind=engine)
    yield
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
        casing_file = ("casing.jpg", b"\xff\xd8\xff\xe0MockJPEGBinary1", "image/jpeg")
        res_casing = await client.post(
            "/api/v1/inspections/ins_1726918195000/image",
            data={"photo_type": "CASING"},
            files={"file": casing_file},
        )
        assert res_casing.status_code == 200
        assert (
            res_casing.json()["path"]
            == "/storage/audit_images/ins_1726918195000_CASING.jpg"
        )

        # 2. Upload DISPLAY image (asserting no overwrite)
        display_file = (
            "display.jpg",
            b"\xff\xd8\xff\xe0MockJPEGBinary2",
            "image/jpeg",
        )
        res_display = await client.post(
            "/api/v1/inspections/ins_1726918195000/image",
            data={"photo_type": "DISPLAY"},
            files={"file": display_file},
        )
        assert res_display.status_code == 200
        assert (
            res_display.json()["path"]
            == "/storage/audit_images/ins_1726918195000_DISPLAY.jpg"
        )
