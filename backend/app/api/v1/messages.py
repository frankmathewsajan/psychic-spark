import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.websocket_manager import ws_manager
from app.models.message import AdminMessage, MessageAck
from app.schemas.message import (
    AdminMessageCreate,
    AdminMessageRead,
    ClientAckResponse,
    ClientAckSubmit,
)

router = APIRouter(tags=["Admin-Client Messaging"])


@router.post(
    "/admin/messages",
    response_model=AdminMessageRead,
    status_code=status.HTTP_201_CREATED,
    summary="Dispatch new message or directive from admin",
)
async def create_admin_message(
    payload: AdminMessageCreate,
    db: Annotated[Session, Depends(get_db)],
):
    msg = AdminMessage(
        id=f"msg_{uuid.uuid4().hex[:12]}",
        target_type=payload.target_type,
        target_id=payload.target_id,
        message_type=payload.message_type,
        priority=payload.priority,
        title=payload.title,
        body=payload.body,
        payload_json=payload.payload_json,
        expires_at=payload.expires_at,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Real-time WebSocket push if target device is online
    push_payload = {
        "type": "ADMIN_MESSAGE",
        "id": msg.id,
        "target_type": msg.target_type,
        "target_id": msg.target_id,
        "message_type": msg.message_type,
        "priority": msg.priority,
        "title": msg.title,
        "body": msg.body,
        "created_at": msg.created_at.isoformat(),
    }

    if msg.target_type == "DEVICE":
        await ws_manager.send_to_device(msg.target_id, push_payload)
    elif msg.target_type == "BROADCAST":
        for dev_id in list(ws_manager.device_sockets.keys()):
            await ws_manager.send_to_device(dev_id, push_payload)

    return AdminMessageRead(
        id=msg.id,
        target_type=msg.target_type,
        target_id=msg.target_id,
        message_type=msg.message_type,
        priority=msg.priority,
        title=msg.title,
        body=msg.body,
        payload_json=msg.payload_json,
        created_at=msg.created_at,
        expires_at=msg.expires_at,
        acks=[],
        ack_count=0,
    )


@router.get(
    "/admin/messages",
    response_model=list[AdminMessageRead],
    summary="List dispatched messages with ACK statistics",
)
def list_admin_messages(
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(50, ge=1, le=100),
):
    messages = (
        db.query(AdminMessage)
        .options(joinedload(AdminMessage.acks))
        .order_by(AdminMessage.created_at.desc())
        .limit(limit)
        .all()
    )

    result: list[AdminMessageRead] = []
    for m in messages:
        read_item = AdminMessageRead(
            id=m.id,
            target_type=m.target_type,
            target_id=m.target_id,
            message_type=m.message_type,
            priority=m.priority,
            title=m.title,
            body=m.body,
            payload_json=m.payload_json,
            created_at=m.created_at,
            expires_at=m.expires_at,
            acks=m.acks,
            ack_count=len(m.acks),
        )
        result.append(read_item)
    return result


@router.get(
    "/devices/{device_id}/messages",
    response_model=list[AdminMessageRead],
    summary="Poll pending messages for a specific device and technician",
)
def get_device_messages(
    device_id: str,
    technician_id: str = Query("ALL"),
    db: Annotated[Session, Depends(get_db)] = None,
):
    """
    Returns messages targeted to ALL, or this technician, or this device.
    Only returns messages not yet ACTIONED by this device.
    """
    now = datetime.now(UTC)

    # Find messages whose target matches BROADCAST/ALL, or specific tech/device
    query = db.query(AdminMessage).filter(
        (AdminMessage.target_type == "BROADCAST")
        | (
            (AdminMessage.target_type == "TECHNICIAN")
            & (AdminMessage.target_id.in_(["ALL", technician_id]))
        )
        | (
            (AdminMessage.target_type == "DEVICE")
            & (AdminMessage.target_id.in_(["ALL", device_id]))
        )
    )

    all_potential = (
        query.order_by(AdminMessage.created_at.desc()).limit(20).all()
    )

    # Exclude messages that have already been marked ACTIONED by this device
    active_messages: list[AdminMessageRead] = []
    for msg in all_potential:
        # Check if expired
        if msg.expires_at and msg.expires_at < now:
            continue

        existing_ack = (
            db.query(MessageAck)
            .filter(
                MessageAck.message_id == msg.id,
                MessageAck.device_id == device_id,
                MessageAck.status == "ACTIONED",
            )
            .first()
        )
        if not existing_ack:
            acks = (
                db.query(MessageAck)
                .filter(
                    MessageAck.message_id == msg.id,
                    MessageAck.device_id == device_id,
                )
                .all()
            )
            active_messages.append(
                AdminMessageRead(
                    id=msg.id,
                    target_type=msg.target_type,
                    target_id=msg.target_id,
                    message_type=msg.message_type,
                    priority=msg.priority,
                    title=msg.title,
                    body=msg.body,
                    payload_json=msg.payload_json,
                    created_at=msg.created_at,
                    expires_at=msg.expires_at,
                    acks=acks,
                    ack_count=len(acks),
                )
            )

    return active_messages


@router.post(
    "/devices/{device_id}/messages/{message_id}/ack",
    response_model=ClientAckResponse,
    status_code=status.HTTP_200_OK,
    summary="Record idempotent acknowledgment from mobile client",
)
def record_message_ack(
    device_id: str,
    message_id: str,
    payload: ClientAckSubmit,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Idempotent acknowledgment handler:
    Returns existing ACK record if already present for (message_id, device_id, status),
    preventing 500 duplicate key errors on mobile network retries.
    """
    msg = db.query(AdminMessage).filter(AdminMessage.id == message_id).first()
    if not msg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Message '{message_id}' not found",
        )

    existing_ack = (
        db.query(MessageAck)
        .filter(
            MessageAck.message_id == message_id,
            MessageAck.device_id == device_id,
            MessageAck.status == payload.status,
        )
        .first()
    )

    if existing_ack:
        return ClientAckResponse(
            status="ALREADY_ACKNOWLEDGED",
            message_id=message_id,
            ack_id=existing_ack.id,
            ack_status=existing_ack.status,
        )

    new_ack = MessageAck(
        id=f"ack_{uuid.uuid4().hex[:12]}",
        message_id=message_id,
        device_id=device_id,
        technician_id=payload.technician_id,
        status=payload.status,
        client_notes=payload.client_notes,
    )
    db.add(new_ack)
    db.commit()
    db.refresh(new_ack)

    return ClientAckResponse(
        status="ACKNOWLEDGED",
        message_id=message_id,
        ack_id=new_ack.id,
        ack_status=new_ack.status,
    )
