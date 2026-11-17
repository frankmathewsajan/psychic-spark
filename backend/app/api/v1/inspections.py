import csv
import hashlib
import io
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.database import get_db
from app.models.inspection import Inspection, InspectionPhoto
from app.schemas.inspection import (
    BatchIngestResponse,
    ImageUploadResponse,
    InspectionDetailItem,
    PhotoType,
    Tier1BatchPayload,
)
from app.services.vlm_auditor import run_vlm_meter_audit

router = APIRouter()


@router.get(
    "/inspections",
    response_model=list[InspectionDetailItem],
    status_code=status.HTTP_200_OK,
    summary="List Recent Inspections with Photos",
)
def list_inspections(
    db: Annotated[Session, Depends(get_db)],
    limit: int = 100,
):
    """
    Returns latest inspections with associated photo metadata, ordered by ingested_at DESC.
    """
    rows = (
        db.query(Inspection)
        .options(joinedload(Inspection.photos))
        .order_by(Inspection.ingested_at.desc())
        .limit(limit)
        .all()
    )
    return rows


@router.get(
    "/inspections/export.csv",
    status_code=status.HTTP_200_OK,
    summary="Export DISCOM Installation QC Audit CSV",
)
def export_qc_audit_csv(
    db: Annotated[Session, Depends(get_db)],
):
    """
    Generates and streams a standardized DISCOM Installation QC Audit CSV.
    """
    rows = (
        db.query(Inspection)
        .order_by(Inspection.ingested_at.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Inspection ID",
        "Timestamp UTC",
        "Technician ID",
        "Device ID",
        "Device Model",
        "Meter S/N",
        "QA Verdict",
        "Wire Hazard Visible",
        "Terminal Cover Seated",
        "Tamper Seal Intact",
        "Casing Undamaged",
        "Edge Reading (kWh)",
        "VLM Reading (kWh)",
        "VLM Audit Stage",
        "Latitude",
        "Longitude",
        "SHA-256 Evidence Seal",
    ])

    for r in rows:
        qc_data = {}
        if r.qc_checklist_json:
            try:
                qc_data = json.loads(r.qc_checklist_json)
            except Exception:
                qc_data = {}

        terminal_cover = qc_data.get("terminal_cover_seated", "N/A")
        tamper_seal = qc_data.get("tamper_seal_intact", "N/A")
        casing = qc_data.get("casing_undamaged", "N/A")
        wire_hazard = qc_data.get("wire_hazard_visible", True if r.qa_status == "CRITICAL_HAZARD" else "N/A")

        writer.writerow([
            r.id,
            r.timestamp_utc,
            r.technician_id,
            r.device_id,
            r.device_model or "Android",
            r.meter_serial_number,
            r.qa_status,
            wire_hazard,
            terminal_cover,
            tamper_seal,
            casing,
            f"{r.kwh_reading:.1f}" if r.kwh_reading is not None else "N/A",
            f"{r.vlm_kwh:.1f}" if r.vlm_kwh is not None else "N/A",
            r.audit_stage,
            f"{r.latitude:.6f}",
            f"{r.longitude:.6f}",
            r.evidence_sha256 or "N/A",
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=DISCOM_Installation_QC_Audit.csv",
        },
    )


@router.post(
    "/inspections/batch",
    response_model=BatchIngestResponse,
    status_code=status.HTTP_200_OK,
    summary="Tier 1 Telemetry Batch Ingestion",
)
def ingest_telemetry_batch(
    payload: Tier1BatchPayload,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Ingests batched inspection metadata over 2G/EDGE cellular.
    Applies idempotency by updating existing records rather than raising constraint errors.
    """
    for item in payload.inspections:
        existing = db.query(Inspection).filter(Inspection.id == item.id).first()

        if existing:
            existing.batch_id = payload.batch_id
            existing.technician_id = item.technician_id
            existing.device_id = item.device_id
            existing.device_model = item.device_model
            existing.app_version = item.app_version
            existing.meter_serial_number = item.meter_serial_number
            existing.timestamp_utc = item.timestamp_utc
            existing.latitude = item.geo[0]
            existing.longitude = item.geo[1]
            existing.qa_status = item.qa_status
            existing.hazard_reason = item.hazard_reason
            existing.kwh_reading = item.kwh_reading
            existing.ocr_confidence = item.ocr_confidence
        else:
            new_record = Inspection(
                id=item.id,
                batch_id=payload.batch_id,
                technician_id=item.technician_id,
                device_id=item.device_id,
                device_model=item.device_model,
                app_version=item.app_version,
                meter_serial_number=item.meter_serial_number,
                timestamp_utc=item.timestamp_utc,
                latitude=item.geo[0],
                longitude=item.geo[1],
                qa_status=item.qa_status,
                hazard_reason=item.hazard_reason,
                kwh_reading=item.kwh_reading,
                ocr_confidence=item.ocr_confidence,
            )
            db.add(new_record)

    db.commit()

    return BatchIngestResponse(
        status="SUCCESS",
        batch_id=payload.batch_id,
        ingested_count=len(payload.inspections),
        received_at=datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


@router.post(
    "/inspections/{inspection_id}/image",
    response_model=ImageUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Tier 2 Audit Image Upload",
)
def upload_audit_image(
    inspection_id: str,
    photo_type: Annotated[PhotoType, Form(...)],
    file: Annotated[UploadFile, File(...)],
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Receives full-res JPEG/PNG images deferred until Wi-Fi availability.
    Runs synchronously in FastAPI's external threadpool to prevent blocking the event loop.
    """
    inspection = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspection record '{inspection_id}' not found. Submit Tier 1 telemetry first.",
        )

    file_ext = Path(file.filename or "").suffix.lower()
    if file_ext not in [".jpg", ".jpeg", ".png"]:
        file_ext = ".jpg"

    file_name = f"{inspection_id}_{photo_type}{file_ext}"

    try:
        file_bytes = file.file.read()
    finally:
        file.file.close()

    if (
        settings.STORAGE_BACKEND == "supabase"
        and settings.SUPABASE_URL
        and settings.SUPABASE_KEY
    ):
        content_type = "image/png" if file_ext == ".png" else "image/jpeg"
        upload_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{settings.SUPABASE_BUCKET}/{file_name}"
        headers = {
            "Authorization": f"Bearer {settings.SUPABASE_KEY}",
            "Content-Type": content_type,
            "x-upsert": "true",
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(upload_url, headers=headers, content=file_bytes)
                if res.status_code not in (200, 201):
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Supabase Storage upload failed: {res.text}",
                    )
            stored_path = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{settings.SUPABASE_BUCKET}/{file_name}"
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to connect to Supabase Storage: {exc!s}",
            ) from exc
    else:
        target_path = settings.STORAGE_DIR / file_name
        try:
            with open(target_path, "wb") as buffer:
                buffer.write(file_bytes)
        except OSError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to persist audit image: {exc!s}",
            ) from exc
        stored_path = f"/storage/audit_images/{file_name}"

    photo_record = (
        db.query(InspectionPhoto)
        .filter(
            InspectionPhoto.inspection_id == inspection_id,
            InspectionPhoto.photo_type == photo_type,
        )
        .first()
    )

    if photo_record:
        photo_record.file_path = stored_path
        photo_record.uploaded_at = datetime.now(UTC)
    else:
        new_photo = InspectionPhoto(
            inspection_id=inspection_id,
            photo_type=photo_type,
            file_path=stored_path,
        )
        db.add(new_photo)

    # Synchronously compute cryptographic SHA-256 evidence seal
    evidence_sha256 = hashlib.sha256(
        file_bytes
        + (inspection.meter_serial_number or "").encode()
        + (inspection.timestamp_utc or "").encode()
    ).hexdigest()
    inspection.evidence_sha256 = evidence_sha256

    # Acknowledgment 1: Mark photo received
    inspection.audit_stage = "IMAGE_RECEIVED"
    db.commit()

    # Trigger Tier-3 Cloud VLM Second-Verification asynchronously in background
    background_tasks.add_task(
        run_vlm_meter_audit,
        inspection_id=inspection_id,
        image_bytes=file_bytes,
        mime_type=file.content_type,
    )

    return ImageUploadResponse(
        status="STORED",
        inspection_id=inspection_id,
        photo_type=photo_type,
        path=stored_path,
    )
