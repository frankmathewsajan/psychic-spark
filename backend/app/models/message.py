import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def get_utc_now() -> datetime:
    return datetime.now(UTC)


class AdminMessage(Base):
    __tablename__ = "admin_messages"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    target_type: Mapped[str] = mapped_column(
        String, nullable=False, default="BROADCAST"
    )  # "BROADCAST", "TECHNICIAN", "DEVICE"
    target_id: Mapped[str] = mapped_column(
        String, nullable=False, default="ALL", index=True
    )  # "ALL" or technician_id or device_id
    message_type: Mapped[str] = mapped_column(
        String, nullable=False, default="ALERT"
    )  # "ALERT", "DIRECTIVE", "REINSPECT", "PING"
    priority: Mapped[str] = mapped_column(
        String, nullable=False, default="NORMAL"
    )  # "LOW", "NORMAL", "URGENT", "CRITICAL"
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_utc_now, nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    acks: Mapped[list["MessageAck"]] = relationship(
        "MessageAck", back_populates="message", cascade="all, delete-orphan"
    )


class MessageAck(Base):
    __tablename__ = "message_acks"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    message_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("admin_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    device_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    technician_id: Mapped[str] = mapped_column(
        String, nullable=False, default="UNKNOWN", index=True
    )
    status: Mapped[str] = mapped_column(
        String, nullable=False
    )  # "DELIVERED", "READ", "ACTIONED"
    ack_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_utc_now, nullable=False
    )
    client_notes: Mapped[str | None] = mapped_column(String, nullable=True)

    message: Mapped[AdminMessage] = relationship("AdminMessage", back_populates="acks")

    __table_args__ = (
        UniqueConstraint(
            "message_id", "device_id", "status", name="uq_message_device_status"
        ),
    )
