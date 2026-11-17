import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def get_utc_now() -> datetime:
    return datetime.now(UTC)


class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    batch_id: Mapped[str] = mapped_column(String, nullable=False)
    technician_id: Mapped[str] = mapped_column(String, nullable=False)
    device_id: Mapped[str] = mapped_column(String, nullable=False, default="UNKNOWN", index=True)
    device_model: Mapped[str | None] = mapped_column(String, nullable=True)
    app_version: Mapped[str | None] = mapped_column(String, nullable=True)
    meter_serial_number: Mapped[str] = mapped_column(String, nullable=False, index=True)
    timestamp_utc: Mapped[str] = mapped_column(String, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    qa_status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    hazard_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    kwh_reading: Mapped[float | None] = mapped_column(Float, nullable=True)
    ocr_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_utc_now, nullable=False
    )

    # Tier-3 Cloud VLM Second-Verification fields
    audit_stage: Mapped[str] = mapped_column(
        String, default="IMAGE_RECEIVED", nullable=False, index=True
    )
    vlm_kwh: Mapped[float | None] = mapped_column(Float, nullable=True)
    vlm_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    vlm_notes: Mapped[str | None] = mapped_column(String, nullable=True)
    vlm_summary: Mapped[str | None] = mapped_column(String, nullable=True)
    vlm_tags: Mapped[str | None] = mapped_column(String, nullable=True)
    qc_checklist_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)

    photos: Mapped[list["InspectionPhoto"]] = relationship(
        "InspectionPhoto", back_populates="inspection", cascade="all, delete-orphan"
    )


class InspectionPhoto(Base):
    __tablename__ = "inspection_photos"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    inspection_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("inspections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    photo_type: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_utc_now, nullable=False
    )

    inspection: Mapped[Inspection] = relationship("Inspection", back_populates="photos")

    __table_args__ = (
        UniqueConstraint(
            "inspection_id", "photo_type", name="uq_inspection_photo_type"
        ),
    )
