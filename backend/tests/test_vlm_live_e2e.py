import asyncio
import os
import sys
from pathlib import Path

# Setup paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.models.inspection import Inspection
from app.services.vlm_auditor import run_vlm_meter_audit


async def main():
    print("=" * 60)
    print("Novo Tier-3 Gemini VLM End-to-End Live Verification Test")
    print("=" * 60)

    # 1. Verify GEMINI_API_KEY
    api_key = settings.GEMINI_API_KEY.strip()
    if not api_key:
        print("ERROR: GEMINI_API_KEY is not configured in backend/.env")
        sys.exit(1)
    masked_key = api_key[:6] + "..." + api_key[-4:]
    print(f"Gemini API Key detected: {masked_key}")

    # 2. Ensure database tables exist
    Base.metadata.create_all(bind=engine)

    # 3. Locate sample image
    root_dir = BACKEND_DIR.parent
    sample_img_path = root_dir / "sample_images" / "liamm_7seg_1.jpg"
    if not sample_img_path.exists():
        # Fallback to any jpg
        jpgs = list((root_dir / "sample_images").glob("*.jpg"))
        if not jpgs:
            print("ERROR: No sample images found in sample_images/")
            sys.exit(1)
        sample_img_path = jpgs[0]

    print(f"Using test sample image: {sample_img_path.name} ({sample_img_path.stat().st_size} bytes)")
    with open(sample_img_path, "rb") as f:
        image_bytes = f.read()

    # 4. Create or reset test inspection
    test_id = "test_vlm_live_001"
    db = SessionLocal()
    try:
        insp = db.query(Inspection).filter(Inspection.id == test_id).first()
        if not insp:
            insp = Inspection(
                id=test_id,
                batch_id="batch_e2e_test",
                technician_id="TECH-LEADER",
                device_id="dev_pixel7_test",
                device_model="Google Pixel 7 Pro",
                app_version="1.0.0",
                meter_serial_number="MTR-VLM-7701",
                timestamp_utc="2026-11-17T12:00:00Z",
                latitude=19.0760,
                longitude=72.8777,
                qa_status="PASS",
                kwh_reading=450.0,
                ocr_confidence=0.88,
                audit_stage="IMAGE_RECEIVED",
            )
            db.add(insp)
        else:
            insp.audit_stage = "IMAGE_RECEIVED"
            insp.vlm_kwh = None
            insp.vlm_notes = None
        db.commit()
    finally:
        db.close()

    print(f"Dispatched test inspection: {test_id} (Initial stage: IMAGE_RECEIVED)")
    print("Executing run_vlm_meter_audit against live Gemini multimodal API...")

    # 5. Run live VLM audit
    await run_vlm_meter_audit(test_id, image_bytes, "image/jpeg")

    # 6. Verify database results
    db = SessionLocal()
    try:
        updated = db.query(Inspection).filter(Inspection.id == test_id).first()
        assert updated is not None, "Inspection was deleted unexpectedly"

        print("-" * 60)
        print("VLM Live Execution Result:")
        print(f"  Audit Stage:     {updated.audit_stage}")
        print(f"  Edge kWh:        {updated.kwh_reading}")
        print(f"  VLM kWh:         {updated.vlm_kwh}")
        print(f"  VLM Confidence:  {updated.vlm_confidence}")
        print(f"  VLM Summary:     {updated.vlm_summary}")
        print(f"  VLM Tags:        {updated.vlm_tags}")
        print(f"  VLM Notes:       {updated.vlm_notes}")
        print("-" * 60)

        assert updated.audit_stage in ["VLM_VERIFIED", "MISMATCH_FLAGGED"], (
            f"Expected audit_stage to be VLM_VERIFIED or MISMATCH_FLAGGED, got {updated.audit_stage}"
        )
        assert updated.vlm_confidence is not None and updated.vlm_confidence >= 0.0, (
            "Expected non-null vlm_confidence"
        )
        assert updated.vlm_summary, "Expected non-empty vlm_summary"
        print("SUCCESS: Live Gemini VLM Second-Verification passed end-to-end!")
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
