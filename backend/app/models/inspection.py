# app/models/inspection.py
import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


def get_utc_now():
    return datetime.now(UTC)


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(String, primary_key=True, index=True, nullable=False)
    batch_id = Column(String, nullable=False)
    technician_id = Column(String, nullable=False)
    meter_serial_number = Column(String, nullable=False, index=True)
    timestamp_utc = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    qa_status = Column(String, nullable=False, index=True)
    hazard_reason = Column(String, nullable=True)
    kwh_reading = Column(Float, nullable=True)
    ocr_confidence = Column(Float, nullable=True)
    ingested_at = Column(DateTime, default=get_utc_now, nullable=False)

    # Relationship to child audit photos
    photos = relationship(
        "InspectionPhoto", back_populates="inspection", cascade="all, delete-orphan"
    )


class InspectionPhoto(Base):
    __tablename__ = "inspection_photos"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    inspection_id = Column(
        String,
        ForeignKey("inspections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    photo_type = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=get_utc_now, nullable=False)

    inspection = relationship("Inspection", back_populates="photos")

    __table_args__ = (
        UniqueConstraint(
            "inspection_id", "photo_type", name="uq_inspection_photo_type"
        ),
    )
