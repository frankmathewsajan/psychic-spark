from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.inspection import HealthResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Diagnostics check",
    responses={
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "Database connection degraded or unavailable",
            "content": {
                "application/json": {
                    "example": {
                        "detail": {
                            "status": "DEGRADED",
                            "database": "DISCONNECTED",
                            "error": "OperationalError",
                        }
                    }
                }
            },
        }
    },
)
def health_check(db: Annotated[Session, Depends(get_db)]):
    try:
        db.execute(text("SELECT 1"))
        db_status = "CONNECTED"
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "DEGRADED",
                "database": "DISCONNECTED",
                "error": str(exc),
            },
        ) from exc

    return HealthResponse(
        status="ONLINE",
        database=db_status,
        timestamp_utc=datetime.now(UTC).isoformat(),
    )
