import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Meter Verification Ingestion Gateway"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    STORAGE_DIR: Path = BASE_DIR / "storage" / "audit_images"

    DATABASE_URL: str = "sqlite:///./inspections.db"

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env")


settings = Settings()
