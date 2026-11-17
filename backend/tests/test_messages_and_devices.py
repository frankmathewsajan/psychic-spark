import pytest
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.main import app
from tests.test_batch_sync import TestingSessionLocal, test_engine


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    # Clean up tables between runs
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    return TestClient(app)


def test_batch_ingest_with_device_attribution(client):
    payload = {
        "batch_id": "batch_attr_123",
        "inspections": [
            {
                "id": "ins_attr_001",
                "technician_id": "TECH-01",
                "device_id": "dev_samsung_s21",
                "device_model": "Samsung Galaxy S21",
                "app_version": "1.0.0",
                "meter_serial_number": "MTR-88990",
                "timestamp_utc": "2026-11-17T12:00:00Z",
                "geo": [12.9716, 77.5946],
                "qa_status": "PASS",
                "kwh_reading": 3450.5,
                "ocr_confidence": 0.95,
            }
        ],
    }
    response = client.post("/api/v1/inspections/batch", json=payload)
    assert response.status_code == 200
    assert response.json()["ingested_count"] == 1

    list_res = client.get("/api/v1/inspections")
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) >= 1
    found = next(i for i in items if i["id"] == "ins_attr_001")
    assert found["device_id"] == "dev_samsung_s21"
    assert found["device_model"] == "Samsung Galaxy S21"
    assert found["app_version"] == "1.0.0"


def test_admin_to_client_messaging_and_idempotent_ack(client):
    # 1. Admin creates a broadcast alert
    msg_payload = {
        "target_type": "BROADCAST",
        "target_id": "ALL",
        "message_type": "ALERT",
        "priority": "URGENT",
        "title": "Safety Warning: Wet Terminal Covers",
        "body": "Technicians must inspect terminal moisture before removing covers.",
    }
    res = client.post("/api/v1/admin/messages", json=msg_payload)
    assert res.status_code == 201
    msg_data = res.json()
    msg_id = msg_data["id"]

    # 2. Client polls messages
    poll_res = client.get("/api/v1/devices/dev_pixel_99/messages?technician_id=TECH-01")
    assert poll_res.status_code == 200
    msgs = poll_res.json()
    assert len(msgs) == 1
    assert msgs[0]["id"] == msg_id

    # 3. Client sends DELIVERED ack
    ack_res = client.post(
        f"/api/v1/devices/dev_pixel_99/messages/{msg_id}/ack",
        json={"technician_id": "TECH-01", "status": "DELIVERED"},
    )
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "ACKNOWLEDGED"

    # 4. Duplicate DELIVERED ack is idempotent (returns 200 OK without 500 error)
    dup_res = client.post(
        f"/api/v1/devices/dev_pixel_99/messages/{msg_id}/ack",
        json={"technician_id": "TECH-01", "status": "DELIVERED"},
    )
    assert dup_res.status_code == 200
    assert dup_res.json()["status"] == "ALREADY_ACKNOWLEDGED"

    # 5. Client sends ACTIONED ack
    action_res = client.post(
        f"/api/v1/devices/dev_pixel_99/messages/{msg_id}/ack",
        json={"technician_id": "TECH-01", "status": "ACTIONED", "client_notes": "Read and understood"},
    )
    assert action_res.status_code == 200
    assert action_res.json()["status"] == "ACKNOWLEDGED"

    # 6. Admin checks message outbox and sees both acks
    admin_list = client.get("/api/v1/admin/messages")
    assert admin_list.status_code == 200
    m_info = next(m for m in admin_list.json() if m["id"] == msg_id)
    assert m_info["ack_count"] == 2
