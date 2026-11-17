from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TargetType = Literal["BROADCAST", "TECHNICIAN", "DEVICE"]
MessageType = Literal["ALERT", "DIRECTIVE", "REINSPECT", "PING"]
PriorityLevel = Literal["LOW", "NORMAL", "URGENT", "CRITICAL"]
AckStatus = Literal["DELIVERED", "READ", "ACTIONED"]


class AdminMessageCreate(BaseModel):
    target_type: TargetType = "BROADCAST"
    target_id: str = "ALL"
    message_type: MessageType = "ALERT"
    priority: PriorityLevel = "NORMAL"
    title: str = Field(..., min_length=1)
    body: str = Field(..., min_length=1)
    payload_json: str | None = None
    expires_at: datetime | None = None


class MessageAckItem(BaseModel):
    id: str
    message_id: str
    device_id: str
    technician_id: str
    status: AckStatus
    ack_at: datetime | str
    client_notes: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminMessageRead(BaseModel):
    id: str
    target_type: str
    target_id: str
    message_type: str
    priority: str
    title: str
    body: str
    payload_json: str | None = None
    created_at: datetime | str
    expires_at: datetime | str | None = None
    acks: list[MessageAckItem] = []
    ack_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ClientAckSubmit(BaseModel):
    technician_id: str = "UNKNOWN"
    status: AckStatus = "DELIVERED"
    client_notes: str | None = None


class ClientAckResponse(BaseModel):
    status: str
    message_id: str
    ack_id: str
    ack_status: str
