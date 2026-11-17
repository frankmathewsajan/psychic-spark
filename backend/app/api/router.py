# app/api/router.py
from fastapi import APIRouter

from app.api.v1 import devices, health, inspections, messages

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(inspections.router, tags=["Inspections"])
api_router.include_router(messages.router, tags=["Messages"])
api_router.include_router(devices.router, tags=["Devices & Realtime Telemetry"])
