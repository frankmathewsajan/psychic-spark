from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def get_utc_now() -> datetime:
    return datetime.now(UTC)


class DeviceRegistry(Base):
    __tablename__ = "device_registry"

    device_id: Mapped[str] = mapped_column(String, primary_key=True)
    technician_id: Mapped[str] = mapped_column(String, nullable=False, default="UNKNOWN")
    device_model: Mapped[str | None] = mapped_column(String, nullable=True)
    app_version: Mapped[str | None] = mapped_column(String, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    battery_level: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )
