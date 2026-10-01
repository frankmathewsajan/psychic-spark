from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Meter Verification Ingestion Gateway"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    STORAGE_DIR: Path = BASE_DIR / "storage" / "audit_images"

    DATABASE_URL: str = "sqlite:///./inspections.db"

    # Storage settings
    STORAGE_BACKEND: str = "local"
    SUPABASE_URL: str = "https://bxnbeatlldxurigjphml.supabase.co"
    SUPABASE_KEY: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4bmJlYXRsbGR4dXJpZ2pwaG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzcyMDgsImV4cCI6MjEwNjQxMzIwOH0.ylevoqrn2jZtXvI0MUV8rDcPYHv5Yt3U4numxdXfbpU"
    SUPABASE_BUCKET: str = "audit-images"

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env")


settings = Settings()
