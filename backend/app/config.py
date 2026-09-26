from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # Resolve .env relative to backend/, so it loads no matter which directory you run from.
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8")

    database_url: str
    jwt_secret: str
    # 24h — matches the frontend's samarth_session_role cookie max-age.
    jwt_expire_minutes: int = 1440
    ml_service_url: str = "http://localhost:8001"
    # Read timeout per ML call. /extract can OCR a scanned PDF and the zero-shot model is
    # slow on first use, so this is well above httpx's 5s default. Connect timeout is 2s.
    ml_timeout_seconds: float = 60
    frontend_url: str = "http://localhost:3000"
    # Uploaded PDFs live here; the DB stores paths relative to it. Gitignored.
    upload_dir: Path = BACKEND_DIR / "uploads"


@lru_cache
def get_settings() -> Settings:
    return Settings()
