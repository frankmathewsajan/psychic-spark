import json
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

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
