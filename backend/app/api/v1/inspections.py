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


@router.get(
    "/inspections/report",
    status_code=status.HTTP_200_OK,
    summary="Generate Government / DISCOM Quality Assurance Audit Report (PDF Printable)",
)
def generate_qc_audit_report(
    db: Annotated[Session, Depends(get_db)],
    format: str | None = None,
):
    """
    Generates a formal, government-standard CEA / DISCOM Installation & Quality Assurance
    Audit Certificate with embedded evidence photos, 4-point QC scorecards, and SHA-256 seals.
    Optimized for high-resolution A4 printing and PDF export.
    """
    rows = (
        db.query(Inspection)
        .options(joinedload(Inspection.photos))
        .order_by(Inspection.ingested_at.desc())
        .all()
    )

    total_count = len(rows)
    pass_count = sum(1 for r in rows if r.qa_status == "PASS")
    vlm_count = sum(1 for r in rows if r.audit_stage == "VLM_VERIFIED")
    warn_count = sum(1 for r in rows if r.qa_status == "WARNING" or r.audit_stage == "MISMATCH_FLAGGED")
    crit_count = sum(1 for r in rows if r.qa_status == "CRITICAL_HAZARD")
    compliance_rate = round((pass_count / total_count * 100) if total_count > 0 else 100.0, 1)

    now_utc = datetime.now(UTC).strftime("%d-%b-%Y %H:%M:%S UTC")
    report_ref = f"CEA/DISCOM/QA-{datetime.now(UTC).strftime('%Y%m%d')}-{hashlib.md5(now_utc.encode()).hexdigest()[:8].upper()}"

    entries_html = []
    for idx, r in enumerate(rows, start=1):
        photo_url = r.photos[0].file_path if r.photos else None
        qc = {}
        if r.qc_checklist_json:
            try:
                qc = json.loads(r.qc_checklist_json)
            except Exception:
                qc = {}

        wire_safe = not qc.get("wire_hazard_visible", False) and r.qa_status != "CRITICAL_HAZARD"
        cover_seated = qc.get("terminal_cover_seated", True) is not False
        seal_intact = qc.get("tamper_seal_intact", True) is not False
        casing_ok = qc.get("casing_undamaged", True) is not False

        photo_markup = f'<img src="{photo_url}" alt="Evidence" class="evidence-img" />' if photo_url else '<div class="no-photo">NO AUDIT IMAGE ARCHIVED</div>'
        
        edge_kwh = f"{r.kwh_reading:.1f} kWh" if r.kwh_reading is not None else "N/A"
        vlm_kwh = f"{r.vlm_kwh:.1f} kWh" if r.vlm_kwh is not None else "N/A"

        entries_html.append(f"""
        <div class="audit-card">
            <div class="card-header">
                <span class="card-num">#{idx}</span>
                <span class="card-meter font-mono">METER S/N: {r.meter_serial_number or 'UNKNOWN'}</span>
                <span class="badge {r.qa_status}">{r.qa_status}</span>
                <span class="badge stage">{r.audit_stage}</span>
            </div>
            <div class="card-grid">
                <div class="photo-col">
                    {photo_markup}
                    <div class="sha-seal font-mono">SHA-256: {r.evidence_sha256 or 'N/A'}</div>
                </div>
                <div class="data-col">
                    <table class="sub-table">
                        <tr><td>Edge OCR Reading:</td><td class="font-mono"><strong>{edge_kwh}</strong></td></tr>
                        <tr><td>Cloud VLM Reading:</td><td class="font-mono"><strong>{vlm_kwh}</strong></td></tr>
                        <tr><td>Technician / Device:</td><td class="font-mono">{r.technician_id or 'UNKNOWN'} &bull; {r.device_id or 'UNKNOWN'}</td></tr>
                        <tr><td>Device Model / App:</td><td>{r.device_model or 'Android'} (v{r.app_version or '1.0.0'})</td></tr>
                        <tr><td>GPS Coordinates:</td><td class="font-mono">{r.latitude:.5f}, {r.longitude:.5f}</td></tr>
                        <tr><td>Inspection Timestamp:</td><td class="font-mono">{r.timestamp_utc or '—'}</td></tr>
                    </table>

                    <div class="qc-checklist">
                        <div class="qc-item {'ok' if wire_safe else 'fail'}">1. Wire Safety: <strong>{'SAFE' if wire_safe else 'CRITICAL HAZARD'}</strong></div>
                        <div class="qc-item {'ok' if cover_seated else 'fail'}">2. Terminal Cover: <strong>{'SEATED' if cover_seated else 'UNSEATED'}</strong></div>
                        <div class="qc-item {'ok' if seal_intact else 'fail'}">3. Tamper Seal: <strong>{'INTACT' if seal_intact else 'COMPROMISED'}</strong></div>
                        <div class="qc-item {'ok' if casing_ok else 'fail'}">4. Casing: <strong>{'UNDAMAGED' if casing_ok else 'DAMAGED'}</strong></div>
                    </div>

                    {f'<div class="vlm-notes"><strong>AI Audit Summary:</strong> {r.vlm_summary}</div>' if r.vlm_summary else ''}
                </div>
            </div>
        </div>
        """)

    records_markup = "".join(entries_html) if entries_html else "<p class='no-data'>No inspection records found in database.</p>"

    auto_print_script = "<script>window.onload = function() { window.print(); };</script>" if format == "print" else ""

    report_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DISCOM Physical Installation QA Audit Report &bull; {report_ref}</title>
  <style>
    @page {{
      size: A4 portrait;
      margin: 14mm 12mm 14mm 12mm;
    }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #111827;
      background: #f3f4f6;
      margin: 0;
      padding: 24px;
      font-size: 12px;
      line-height: 1.4;
    }}
    .font-mono {{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }}
    .container {{
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      padding: 32px 40px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      border-radius: 4px;
    }}
    .print-actions {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
    }}
    .btn {{
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }}
    .btn-primary {{ background: #111827; color: #ffffff; border: 1px solid #111827; }}
    .btn-primary:hover {{ background: #1f2937; }}
    .btn-secondary {{ background: #ffffff; color: #374151; border: 1px solid #d1d5db; }}
    .gov-header {{
      text-align: center;
      border-bottom: 2px solid #111827;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }}
    .gov-emblem {{ font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #4b5563; text-transform: uppercase; }}
    .gov-title {{ font-size: 18px; font-weight: 900; color: #111827; margin: 4px 0 2px 0; text-transform: uppercase; letter-spacing: 0.5px; }}
    .gov-subtitle {{ font-size: 12px; font-weight: 600; color: #374151; }}
    .doc-meta {{
      display: flex;
      justify-content: space-between;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 10px 14px;
      border-radius: 4px;
      margin-bottom: 20px;
      font-size: 11px;
    }}
    .summary-grid {{
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-bottom: 24px;
    }}
    .summary-box {{
      border: 1px solid #e5e7eb;
      padding: 10px;
      border-radius: 4px;
      background: #fafafa;
      text-align: center;
    }}
    .summary-box .val {{ font-size: 20px; font-weight: 800; font-family: monospace; color: #111827; margin-top: 2px; }}
    .summary-box .lbl {{ font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; }}
    .section-title {{
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #111827;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 6px;
      margin: 24px 0 14px 0;
    }}
    .audit-card {{
      border: 1px solid #d1d5db;
      border-radius: 4px;
      padding: 14px;
      margin-bottom: 14px;
      page-break-inside: avoid;
      background: #ffffff;
    }}
    .card-header {{
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #f3f4f6;
      padding-bottom: 8px;
      margin-bottom: 10px;
      font-size: 12px;
    }}
    .card-num {{ font-weight: 800; color: #6b7280; }}
    .card-meter {{ font-weight: 800; font-size: 13px; color: #111827; }}
    .badge {{
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }}
    .badge.PASS {{ background: #dcfce7; color: #15803d; }}
    .badge.WARNING {{ background: #fef3c7; color: #b45309; }}
    .badge.CRITICAL_HAZARD {{ background: #fee2e2; color: #b91c1c; }}
    .badge.stage {{ background: #f3f4f6; color: #374151; font-family: monospace; }}
    .card-grid {{
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 16px;
    }}
    .photo-col {{ text-align: center; }}
    .evidence-img {{
      width: 100%;
      height: 180px;
      object-fit: contain;
      background: #111827;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
    }}
    .no-photo {{
      width: 100%;
      height: 180px;
      background: #f3f4f6;
      border: 1px dashed #d1d5db;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: #9ca3af;
      font-family: monospace;
    }}
    .sha-seal {{
      font-size: 9px;
      color: #6b7280;
      word-break: break-all;
      margin-top: 6px;
      padding: 4px;
      background: #f9fafb;
      border: 1px solid #f3f4f6;
      border-radius: 2px;
    }}
    .sub-table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-bottom: 10px;
    }}
    .sub-table td {{
      padding: 4px 6px;
      border-bottom: 1px solid #f3f4f6;
    }}
    .sub-table td:first-child {{
      color: #6b7280;
      width: 150px;
    }}
    .qc-checklist {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin: 10px 0;
    }}
    .qc-item {{
      padding: 6px 8px;
      border-radius: 3px;
      font-size: 10px;
      border: 1px solid #e5e7eb;
    }}
    .qc-item.ok {{ background: #f0fdf4; border-color: #bbf7d0; color: #166534; }}
    .qc-item.fail {{ background: #fef2f2; border-color: #fecaca; color: #991b1b; }}
    .vlm-notes {{
      font-size: 11px;
      color: #374151;
      background: #f9fafb;
      padding: 8px 10px;
      border-radius: 3px;
      border-left: 3px solid #6b7280;
      margin-top: 8px;
    }}
    .sign-block {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 40px;
      padding-top: 24px;
      border-top: 2px solid #111827;
      page-break-inside: avoid;
    }}
    .sign-box {{ text-align: center; }}
    .sign-line {{
      height: 40px;
      border-bottom: 1px solid #111827;
      margin-bottom: 8px;
    }}
    .sign-name {{ font-weight: 700; font-size: 12px; }}
    .sign-role {{ font-size: 10px; color: #6b7280; text-transform: uppercase; }}
    @media print {{
      body {{ background: #ffffff; padding: 0; }}
      .container {{ box-shadow: none; padding: 0; max-width: 100%; }}
      .print-actions {{ display: none !important; }}
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="print-actions">
      <div>
        <a href="/admin" class="btn btn-secondary">&larr; Return to Admin Console</a>
      </div>
      <div style="display: flex; gap: 8px;">
        <a href="/api/v1/inspections/export.csv" class="btn btn-secondary">Download CSV</a>
        <button onclick="window.print()" class="btn btn-primary">Print / Save as PDF</button>
      </div>
    </div>

    <div class="gov-header">
      <div class="gov-emblem">Central Electricity Authority &bull; State Power Distribution Corporation</div>
      <div class="gov-title">Smart Meter Physical Installation QA Audit Report</div>
      <div class="gov-subtitle">Statutory Verification Certificate under IS 16444 / IS 15884 & RDSS Quality Interlock Standards</div>
    </div>

    <div class="doc-meta">
      <div><strong>Audit Reference:</strong> <span class="font-mono">{report_ref}</span></div>
      <div><strong>Date & Time:</strong> <span class="font-mono">{now_utc}</span></div>
      <div><strong>Compliance Rating:</strong> <strong>{compliance_rate}%</strong></div>
    </div>

    <div class="summary-grid">
      <div class="summary-box">
        <div class="lbl">Total Ingested</div>
        <div class="val">{total_count}</div>
      </div>
      <div class="summary-box">
        <div class="lbl">Edge Passes</div>
        <div class="val" style="color: #15803d;">{pass_count}</div>
      </div>
      <div class="summary-box">
        <div class="lbl">VLM Verified</div>
        <div class="val" style="color: #0d9488;">{vlm_count}</div>
      </div>
      <div class="summary-box">
        <div class="lbl">Warnings / Flags</div>
        <div class="val" style="color: #b45309;">{warn_count}</div>
      </div>
      <div class="summary-box">
        <div class="lbl">Safety Hazards</div>
        <div class="val" style="color: #b91c1c;">{crit_count}</div>
      </div>
    </div>

    <div class="section-title">Verified Meter Inspection Dossiers</div>
    {records_markup}

    <div class="sign-block">
      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-name">Lead Field Operations Technician</div>
        <div class="sign-role">Certified Metering Field Engineer</div>
      </div>
      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-name">DISCOM Quality Assurance Officer</div>
        <div class="sign-role">Authorised Inspection Authority</div>
      </div>
    </div>
  </div>
  {auto_print_script}
</body>
</html>
"""
    return Response(content=report_html, media_type="text/html")


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
