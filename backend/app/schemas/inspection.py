# app/schemas/inspection.py
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

QAStatus = Literal["PASS", "WARNING", "CRITICAL_HAZARD"]
PhotoType = Literal["CASING", "TERMINAL_COVER", "DISPLAY", "TAMPER_SEAL"]


class InspectionTelemetryItem(BaseModel):
    id: str = Field(
        ..., description="Unique client inspection ID (e.g., ins_1726918195000)"
    )
    technician_id: str
    meter_serial_number: str
    timestamp_utc: str
    geo: tuple[float, float] = Field(..., description="[Latitude, Longitude]")
    qa_status: QAStatus
    hazard_reason: str | None = None
    kwh_reading: float | None = None
    ocr_confidence: float | None = None

    model_config = ConfigDict(from_attributes=True)


class Tier1BatchPayload(BaseModel):
    batch_id: str
    inspections: list[InspectionTelemetryItem]


class BatchIngestResponse(BaseModel):
    status: str
    batch_id: str
    ingested_count: int
    received_at: str


class ImageUploadResponse(BaseModel):
    status: str
    inspection_id: str
    photo_type: str
    path: str


class HealthResponse(BaseModel):
    status: str
    database: str
    timestamp_utc: str


class PhotoReadItem(BaseModel):
    id: str
    photo_type: str
    file_path: str
    uploaded_at: datetime | str

    model_config = ConfigDict(from_attributes=True)


class InspectionDetailItem(BaseModel):
    id: str
    batch_id: str
    technician_id: str
    meter_serial_number: str
    timestamp_utc: str
    latitude: float
    longitude: float
    qa_status: QAStatus
    hazard_reason: str | None = None
    kwh_reading: float | None = None
    ocr_confidence: float | None = None
    ingested_at: datetime | str
    audit_stage: str = "IMAGE_RECEIVED"
    vlm_kwh: float | None = None
    vlm_confidence: float | None = None
    vlm_notes: str | None = None
    vlm_summary: str | None = None
    vlm_tags: str | None = None
    photos: list[PhotoReadItem] = []

    model_config = ConfigDict(from_attributes=True)
