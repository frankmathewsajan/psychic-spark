import json
import logging
from typing import Any

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.inspection import Inspection

logger = logging.getLogger("vlm_auditor")

PRIMARY_MODEL = "gemini-3.8-flash"
FALLBACK_MODEL = "gemini-4-hydrogen"

PROMPT_TEXT = """
You are an expert electric utility meter quality assurance inspector.
Analyze this meter inspection photo for Physical Installation Quality Control (QC).
Return strict JSON with this exact schema:
{
  "kwh_reading": float or null,
  "register_unit": "kWh" or "kVAh" or "OTHER",
  "serial_number": string or null,
  "terminal_cover_seated": boolean,
  "tamper_seal_intact": boolean,
  "casing_undamaged": boolean,
  "wire_hazard_visible": boolean,
  "confidence": float between 0.0 and 1.0,
  "summary": string,
  "tags": list of strings
}

Rules:
1. Extract the active cumulative kilowatt-hour numeric reading from the display.
2. If the display shows a decimal point (for example: 1428.5), keep it.
3. If the reading is not legible or missing, set kwh_reading to null.
4. Set wire_hazard_visible to true if loose, bare, damaged wires or missing covers appear.
5. Set terminal_cover_seated to true if the bottom terminal cover is flush and closed.
6. Set tamper_seal_intact to true if utility lead/wire security seal is visible and intact.
7. Set casing_undamaged to true if the outer meter polycarbonate enclosure has no cracks or burns.
8. Provide a short factual summary in simple English.
"""


def detect_mime_type(image_bytes: bytes, fallback_mime: str | None = None) -> str:
    if image_bytes.startswith(b"\x89PNG"):
        return "image/png"
    if image_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if fallback_mime and "png" in fallback_mime.lower():
        return "image/png"
    return "image/jpeg"


def execute_vlm_generation(
    api_key: str,
    image_bytes: bytes,
    mime_type: str,
) -> dict[str, Any]:
    client = genai.Client(api_key=api_key)
    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=0.0,
    )

    models_to_try = [PRIMARY_MODEL, FALLBACK_MODEL]
    last_error: Exception | None = None

    for model in models_to_try:
        try:
            logger.info("Calling Gemini model %s for meter audit...", model)
            response = client.models.generate_content(
                model=model,
                contents=[image_part, PROMPT_TEXT],
                config=config,
            )
            raw_text = response.text or ""
            return json.loads(raw_text) if raw_text else {}
        except Exception as exc:
            logger.warning("Gemini model %s failed: %s", model, exc)
            last_error = exc

    if last_error:
        raise last_error
    return {}


async def run_vlm_meter_audit(
    inspection_id: str,
    image_bytes: bytes,
    mime_type: str | None = None,
) -> None:
    """
    Tier-3 Asynchronous Cloud VLM Second-Verification.
    Uses dedicated SessionLocal to avoid using closed request-scoped sessions.
    """
    db = SessionLocal()
    try:
        inspection = (
            db.query(Inspection).filter(Inspection.id == inspection_id).first()
        )
        if not inspection:
            logger.warning(
                "Inspection %s not found for VLM audit", inspection_id
            )
            return

        api_key = settings.GEMINI_API_KEY.strip()
        if not api_key:
            inspection.audit_stage = "VLM_SKIPPED"
            inspection.vlm_notes = "GEMINI_API_KEY not configured"
            db.commit()
            logger.info("VLM audit skipped: no GEMINI_API_KEY")
            return

        actual_mime = detect_mime_type(image_bytes, mime_type)
        data = execute_vlm_generation(api_key, image_bytes, actual_mime)

        vlm_kwh = data.get("kwh_reading")
        if vlm_kwh is not None:
            try:
                vlm_kwh = float(vlm_kwh)
            except (ValueError, TypeError):
                vlm_kwh = None

        unit = str(data.get("register_unit", "kWh")).strip()
        confidence = float(data.get("confidence", 0.0))
        summary = str(data.get("summary", ""))
        tags_list = data.get("tags", [])
        tags_str = ", ".join(tags_list) if isinstance(tags_list, list) else ""

        qc_checklist = {
            "terminal_cover_seated": bool(data.get("terminal_cover_seated", True)),
            "tamper_seal_intact": bool(data.get("tamper_seal_intact", True)),
            "casing_undamaged": bool(data.get("casing_undamaged", True)),
            "wire_hazard_visible": bool(data.get("wire_hazard_visible", False)),
        }
        inspection.qc_checklist_json = json.dumps(qc_checklist)

        if not inspection.evidence_sha256:
            import hashlib
            inspection.evidence_sha256 = hashlib.sha256(
                image_bytes
                + (inspection.meter_serial_number or "").encode()
                + (inspection.timestamp_utc or "").encode()
            ).hexdigest()

        inspection.vlm_kwh = vlm_kwh
        inspection.vlm_confidence = confidence
        inspection.vlm_summary = summary
        inspection.vlm_tags = tags_str

        edge_kwh = inspection.kwh_reading

        # Reconciliation Logic
        if edge_kwh is None:
            if vlm_kwh is not None and unit == "kWh" and confidence >= 0.70:
                inspection.kwh_reading = vlm_kwh
                inspection.audit_stage = "VLM_VERIFIED"
                inspection.vlm_notes = (
                    "Reconciled missing edge reading via Cloud VLM"
                )
            else:
                inspection.audit_stage = "VLM_VERIFIED"
                inspection.vlm_notes = "Confirmed unreadable or absent display"
        else:
            if vlm_kwh is not None:
                diff = abs(edge_kwh - vlm_kwh)
                if diff > 1.0 or unit != "kWh":
                    inspection.audit_stage = "MISMATCH_FLAGGED"
                    inspection.vlm_notes = f"Discrepancy: Edge={edge_kwh} vs VLM={vlm_kwh} {unit}"
                else:
                    inspection.audit_stage = "VLM_VERIFIED"
                    inspection.vlm_notes = (
                        f"Consistent with Edge OCR (diff={diff:.2f})"
                    )
            else:
                inspection.audit_stage = "VLM_VERIFIED"
                inspection.vlm_notes = (
                    "VLM display detection unclear; retained Edge OCR"
                )

        db.commit()
        logger.info(
            "VLM audit complete for %s: stage=%s",
            inspection_id,
            inspection.audit_stage,
        )

    except Exception as exc:
        db.rollback()
        logger.exception("Error executing VLM audit for %s", inspection_id)
        try:
            insp = (
                db.query(Inspection)
                .filter(Inspection.id == inspection_id)
                .first()
            )
            if insp:
                insp.audit_stage = "VLM_SKIPPED"
                insp.vlm_notes = f"Audit exception: {exc!s}"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
