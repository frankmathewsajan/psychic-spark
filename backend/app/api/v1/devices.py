import json
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.database import SessionLocal, get_db
from app.core.websocket_manager import ws_manager
from app.models.device import DeviceRegistry
from app.models.inspection import Inspection, InspectionPhoto
from app.models.message import AdminMessage, MessageAck

router = APIRouter(tags=["Devices & Realtime Telemetry"])


class ResetDataRequest(BaseModel):
    confirm: str


@router.get("/devices", summary="List registered devices with presence & telemetry")
def list_devices(db: Annotated[Session, Depends(get_db)]):
    rows = db.query(DeviceRegistry).order_by(DeviceRegistry.last_seen_at.desc()).all()
    result = []
    for d in rows:
        online = ws_manager.is_device_online(d.device_id)
        result.append({
            "device_id": d.device_id,
            "technician_id": d.technician_id,
            "device_model": d.device_model,
            "app_version": d.app_version,
            "latitude": d.latitude,
            "longitude": d.longitude,
            "battery_level": d.battery_level,
            "is_online": online,
            "last_seen_at": d.last_seen_at.isoformat() if d.last_seen_at else None,
        })
    return result


@router.get("/devices/{device_id}/restore", summary="Export all cloud inspections and photo paths for local device restoration")
def get_device_restore_payload(device_id: str, db: Annotated[Session, Depends(get_db)]):
    dev = db.query(DeviceRegistry).filter(DeviceRegistry.device_id == device_id).first()
    
    rows = (
        db.query(Inspection)
        .options(joinedload(Inspection.photos))
        .filter(Inspection.device_id == device_id)
        .order_by(Inspection.ingested_at.desc())
        .all()
    )
    
    # If no records match exact device_id, fallback to technician match or unassigned records
    if not rows and dev and dev.technician_id:
        rows = (
            db.query(Inspection)
            .options(joinedload(Inspection.photos))
            .filter(
                (Inspection.device_id == device_id) |
                (Inspection.technician_id == dev.technician_id) |
                (Inspection.device_id == "UNKNOWN")
            )
            .order_by(Inspection.ingested_at.desc())
            .all()
        )
        
    # If still empty, return all available fleet inspections so device can restore history
    if not rows:
        rows = (
            db.query(Inspection)
            .options(joinedload(Inspection.photos))
            .order_by(Inspection.ingested_at.desc())
            .limit(50)
            .all()
        )

    result = []
    for r in rows:
        photos = [{"photo_type": p.photo_type, "file_path": p.file_path} for p in r.photos]
        result.append({
            "id": r.id,
            "batch_id": r.batch_id,
            "technician_id": r.technician_id,
            "device_id": r.device_id,
            "device_model": r.device_model,
            "app_version": r.app_version,
            "meter_serial_number": r.meter_serial_number,
            "timestamp_utc": r.timestamp_utc,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "qa_status": r.qa_status,
            "hazard_reason": r.hazard_reason,
            "kwh_reading": r.kwh_reading,
            "ocr_confidence": r.ocr_confidence,
            "audit_stage": r.audit_stage,
            "vlm_kwh": r.vlm_kwh,
            "vlm_notes": r.vlm_notes,
            "vlm_summary": r.vlm_summary,
            "vlm_tags": r.vlm_tags,
            "qc_checklist_json": r.qc_checklist_json,
            "evidence_sha256": r.evidence_sha256,
            "photos": photos,
        })
    return result


@router.post("/devices/{device_id}/sync-back", summary="Trigger cloud sync back to device over WebSocket or mark for restore")
async def trigger_sync_back_to_device(device_id: str, db: Annotated[Session, Depends(get_db)]):
    dev = db.query(DeviceRegistry).filter(DeviceRegistry.device_id == device_id).first()
    count = db.query(Inspection).filter(Inspection.device_id == device_id).count()
    
    # If device was recently registered or wiped, match by technician or fleet total
    if count == 0 and dev and dev.technician_id:
        count = db.query(Inspection).filter(
            (Inspection.device_id == device_id) | 
            (Inspection.technician_id == dev.technician_id) | 
            (Inspection.device_id == "UNKNOWN")
        ).count()
    if count == 0:
        count = db.query(Inspection).count()
        
    is_online = ws_manager.is_device_online(device_id)
    sent_ws = False
    if is_online:
        sent_ws = await ws_manager.send_to_device(device_id, {
            "type": "SYNC_BACK_REQUEST",
            "device_id": device_id,
            "inspection_count": count,
            "message": f"Admin requested restore of {count} cloud inspections to device."
        })

    # Persistent directive so device restores even if WebSocket reconnects or polls
    sync_msg = AdminMessage(
        target_type="DEVICE",
        target_id=device_id,
        message_type="SYNC_BACK",
        priority="HIGH",
        title="Cloud Data Restore",
        body=f"Supervisor triggered cloud restore of {count} historical inspections to this handset.",
        payload_json=json.dumps({"inspection_count": count, "trigger": "ADMIN_SYNC_BACK"}),
    )
    db.add(sync_msg)
    db.commit()

    return {
        "status": "SUCCESS",
        "device_id": device_id,
        "is_online": is_online,
        "sent_via_websocket": sent_ws,
        "inspection_count": count,
        "message": f"Sync back triggered for device {device_id} ({count} inspections available in cloud)."
    }


@router.post("/admin/reset-data", summary="Purge dummy data from tables")
def reset_server_data(payload: ResetDataRequest, db: Annotated[Session, Depends(get_db)]):
    if payload.confirm != "RESET_ALL_DATA":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Must confirm with 'RESET_ALL_DATA'")
    db.query(MessageAck).delete()
    db.query(AdminMessage).delete()
    db.query(InspectionPhoto).delete()
    db.query(Inspection).delete()
    db.query(DeviceRegistry).delete()
    db.commit()
    return {"status": "SUCCESS", "message": "All data cleared successfully."}


@router.websocket("/ws/admin")
async def websocket_admin_endpoint(websocket: WebSocket):
    await ws_manager.connect_admin(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_admin(websocket)


@router.websocket("/ws/device/{device_id}")
async def websocket_device_endpoint(
    device_id: str,
    websocket: WebSocket,
    db: Annotated[Session, Depends(get_db)],
):
    await ws_manager.connect_device(device_id, websocket)
    try:
        # Register or update online status
        dev = db.query(DeviceRegistry).filter(DeviceRegistry.device_id == device_id).first()
        if not dev:
            dev = DeviceRegistry(device_id=device_id, is_online=True)
            db.add(dev)
        else:
            dev.is_online = True
            dev.last_seen_at = datetime.now(UTC)
        db.commit()

        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                continue

            msg_type = data.get("type", "HEARTBEAT")
            if msg_type in ("HEARTBEAT", "TELEMETRY"):
                dev = db.query(DeviceRegistry).filter(DeviceRegistry.device_id == device_id).first()
                if dev:
                    if "lat" in data and data["lat"]:
                        dev.latitude = float(data["lat"])
                    if "lon" in data and data["lon"]:
                        dev.longitude = float(data["lon"])
                    if "battery" in data:
                        dev.battery_level = float(data["battery"]) if data["battery"] is not None else None
                    if "technician_id" in data and data["technician_id"]:
                        dev.technician_id = str(data["technician_id"])
                    if "device_model" in data and data["device_model"]:
                        dev.device_model = str(data["device_model"])
                    if "app_version" in data and data["app_version"]:
                        dev.app_version = str(data["app_version"])
                    dev.last_seen_at = datetime.now(UTC)
                    dev.is_online = True
                    db.commit()

                # Broadcast live position to admin map
                await ws_manager.broadcast_to_admins({
                    "type": "DEVICE_UPDATE",
                    "device_id": device_id,
                    "technician_id": data.get("technician_id", dev.technician_id if dev else "UNKNOWN"),
                    "lat": dev.latitude if dev else None,
                    "lon": dev.longitude if dev else None,
                    "battery": dev.battery_level if dev else None,
                    "is_online": True,
                    "last_seen_at": datetime.now(UTC).isoformat(),
                })

            elif msg_type == "ACK":
                # Handle real-time ACK over WebSocket
                message_id = data.get("message_id")
                ack_status = data.get("status", "ACTIONED")
                notes = data.get("client_notes")
                tech_id = data.get("technician_id", "UNKNOWN")
                if message_id:
                    existing = db.query(MessageAck).filter(
                        MessageAck.message_id == message_id,
                        MessageAck.device_id == device_id,
                        MessageAck.status == ack_status,
                    ).first()
                    if not existing:
                        new_ack = MessageAck(
                            message_id=message_id,
                            device_id=device_id,
                            technician_id=tech_id,
                            status=ack_status,
                            client_notes=notes,
                        )
                        db.add(new_ack)
                        db.commit()
                    # Broadcast ACK to admin consoles
                    await ws_manager.broadcast_to_admins({
                        "type": "MESSAGE_ACK",
                        "message_id": message_id,
                        "device_id": device_id,
                        "technician_id": tech_id,
                        "status": ack_status,
                        "client_notes": notes,
                    })

    except WebSocketDisconnect:
        ws_manager.disconnect_device(device_id)
        dev = db.query(DeviceRegistry).filter(DeviceRegistry.device_id == device_id).first()
        if dev:
            dev.is_online = False
            dev.last_seen_at = datetime.now(UTC)
            db.commit()
        await ws_manager.broadcast_to_admins({
            "type": "DEVICE_PRESENCE",
            "device_id": device_id,
            "is_online": False,
            "last_seen_at": datetime.now(UTC).isoformat(),
        })
    finally:
        pass
