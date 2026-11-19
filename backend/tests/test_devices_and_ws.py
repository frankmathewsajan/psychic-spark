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
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    return TestClient(app)


def test_device_websocket_and_telemetry(client):
    # 1. Connect device over WebSocket
    with client.websocket_connect("/api/v1/ws/device/dev_field_01") as ws:
        # Send telemetry frame
        ws.send_json({
            "type": "TELEMETRY",
            "lat": 19.0760,
            "lon": 72.8777,
            "battery": 0.88,
            "technician_id": "TECH-01",
            "device_model": "Pixel 7 Pro",
            "app_version": "1.0.0",
        })

        # 2. Check device listing shows device is online
        res = client.get("/api/v1/devices")
        assert res.status_code == 200
        devices = res.json()
        assert len(devices) >= 1
        dev = next(d for d in devices if d["device_id"] == "dev_field_01")
        assert dev["is_online"] is True
        assert dev["latitude"] == 19.0760

        # 3. Admin dispatches message to online device
        msg_res = client.post("/api/v1/admin/messages", json={
            "target_type": "DEVICE",
            "target_id": "dev_field_01",
            "message_type": "ALERT",
            "priority": "CRITICAL",
            "title": "Substation Warning",
            "body": "De-energize circuit breaker before proceeding.",
        })
        assert msg_res.status_code == 201

        # 4. Device receives message over WebSocket in real time!
        received = ws.receive_json()
        assert received["type"] == "ADMIN_MESSAGE"
        assert received["id"] == msg_res.json()["id"]

        # 5. Device sends ACK with technician reply over WebSocket
        ws.send_json({
            "type": "ACK",
            "message_id": received["id"],
            "status": "ACTIONED",
            "technician_id": "TECH-01",
            "client_notes": "Main breaker de-energized and locked out.",
        })

    # After websocket closes, verify device is marked offline
    res_after = client.get("/api/v1/devices")
    dev_after = next(d for d in res_after.json() if d["device_id"] == "dev_field_01")
    assert dev_after["is_online"] is False


def test_admin_reset_data(client):
    # Attempt reset without valid confirmation string
    bad_res = client.post("/api/v1/admin/reset-data", json={"confirm": "INVALID"})
    assert bad_res.status_code == 400

    # Successful reset
    ok_res = client.post("/api/v1/admin/reset-data", json={"confirm": "RESET_ALL_DATA"})
    assert ok_res.status_code == 200
    assert ok_res.json()["status"] == "SUCCESS"


def test_device_restore_and_sync_back(client):
    # 1. Ingest an inspection for device dev_restore_01
    batch_payload = {
        "batch_id": "batch_restore_01",
        "inspections": [
            {
                "id": "insp_restore_01",
                "technician_id": "TECH-RESTORE",
                "device_id": "dev_restore_01",
                "device_model": "Realme 11 Pro",
                "app_version": "1.0.0",
                "meter_serial_number": "EB998877",
                "timestamp_utc": "2026-11-19T11:00:00Z",
                "geo": [19.0760, 72.8777],
                "qa_status": "PASS",
                "kwh_reading": 507106.0,
                "ocr_confidence": 0.98,
            }
        ]
    }
    batch_res = client.post("/api/v1/inspections/batch", json=batch_payload)
    assert batch_res.status_code == 200

    # 2. Query restore endpoint for dev_restore_01
    restore_res = client.get("/api/v1/devices/dev_restore_01/restore")
    assert restore_res.status_code == 200
    records = restore_res.json()
    assert len(records) == 1
    assert records[0]["id"] == "insp_restore_01"
    assert records[0]["meter_serial_number"] == "EB998877"
    assert records[0]["kwh_reading"] == 507106.0

    # 3. Trigger sync-back endpoint
    sync_res = client.post("/api/v1/devices/dev_restore_01/sync-back")
    assert sync_res.status_code == 200
    data = sync_res.json()
    assert data["status"] == "SUCCESS"
    assert data["inspection_count"] == 1

