from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.inspection import Inspection, InspectionPhoto
from app.schemas.inspection import (
    BatchIngestResponse,
    ImageUploadResponse,
    PhotoType,
    Tier1BatchPayload,
)

router = APIRouter()


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

    db.commit()

    return ImageUploadResponse(
        status="STORED",
        inspection_id=inspection_id,
        photo_type=photo_type,
        path=stored_path,
    )
