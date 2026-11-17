import csv
import io
import json
import pytest
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.main import app
from app.models.inspection import Inspection
from tests.test_batch_sync import TestingSessionLocal, test_engine


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    return TestClient(app)


def test_export_qc_csv_endpoint(client):
    db = TestingSessionLocal()
    test_id = "insp_test_qc_csv"
    try:
        insp = Inspection(
            id=test_id,
            batch_id="batch_qc_test",
            technician_id="TECH_QC_TEST",
            device_id="DEV_QC_TEST",
            device_model="Test Phone",
            meter_serial_number="METER-QC-12345",
            timestamp_utc="2026-11-17T08:00:00Z",
            latitude=19.0760,
            longitude=72.8777,
            qa_status="PASS",
            kwh_reading=456.7,
            vlm_kwh=456.7,
            audit_stage="VLM_VERIFIED",
            qc_checklist_json=json.dumps({
                "terminal_cover_seated": True,
                "tamper_seal_intact": True,
                "casing_undamaged": True,
                "wire_hazard_visible": False,
            }),
            evidence_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        )
        db.add(insp)
        db.commit()

        # Call the CSV export endpoint
        response = client.get("/api/v1/inspections/export.csv")
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]
        assert "attachment; filename=DISCOM_Installation_QC_Audit.csv" in response.headers["content-disposition"]

        reader = csv.reader(io.StringIO(response.text))
        header = next(reader)
        assert "Inspection ID" in header
        assert "Wire Hazard Visible" in header
        assert "Terminal Cover Seated" in header
        assert "Tamper Seal Intact" in header
        assert "Casing Undamaged" in header
        assert "SHA-256 Evidence Seal" in header

        rows = list(reader)
        test_rows = [r for r in rows if r[0] == test_id]
        assert len(test_rows) == 1
        row = test_rows[0]
        # Check values
        assert row[5] == "METER-QC-12345"
        assert row[6] == "PASS"
        assert row[7] == "False"  # wire hazard
        assert row[8] == "True"   # terminal cover seated
        assert row[9] == "True"   # tamper seal intact
        assert row[10] == "True"  # casing undamaged
        assert row[16] == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    finally:
        db.close()
