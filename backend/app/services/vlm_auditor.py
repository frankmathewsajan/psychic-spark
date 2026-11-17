import base64
import json
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.inspection import Inspection

logger = logging.getLogger("vlm_auditor")

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

PROMPT_TEXT = """
Analyze this electric utility meter inspection photo.
Return JSON with this exact schema:
{
  "kwh_reading": float or null,
  "register_unit": "kWh" or "kVAh" or "OTHER",
  "serial_number": string or null,
  "wire_hazard_visible": boolean,
  "confidence": float between 0.0 and 1.0,
  "summary": string,
  "tags": list of strings
}
Only extract the active cumulative consumption reading. If the reading is obscured or absent, use null.
"""


def detect_mime_type(image_bytes: bytes, fallback_mime: str | None = None) -> str:
    if image_bytes.startswith(b"\x89PNG"):
        return "image/png"
    if image_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if fallback_mime and "png" in fallback_mime.lower():
        return "image/png"
    return "image/jpeg"


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
        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "inline_data": {
                                "mime_type": actual_mime,
                                "data": b64_image,
                            }
                        },
                        {"text": PROMPT_TEXT},
                    ]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1,
            },
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(
                f"{GEMINI_API_URL}?key={api_key}",
                json=payload,
                headers={"Content-Type": "application/json"},
            )

        if res.status_code != 200:
            inspection.audit_stage = "VLM_SKIPPED"
            inspection.vlm_notes = f"Gemini API HTTP {res.status_code}"
            db.commit()
            logger.warning(
                "Gemini audit failed with HTTP %s: %s",
                res.status_code,
                res.text[:200],
            )
            return

        body = res.json()
        raw_text = (
            body.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )

        data: dict[str, Any] = json.loads(raw_text) if raw_text else {}

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
                inspection.vlm_notes = "Confirmed unreadable or absent LCD"
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
                    "VLM LCD detection unclear; retained Edge OCR"
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
