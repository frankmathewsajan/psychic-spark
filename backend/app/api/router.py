# app/api/router.py
from fastapi import APIRouter

from app.api.v1 import health, inspections

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(inspections.router, tags=["Inspections"])
