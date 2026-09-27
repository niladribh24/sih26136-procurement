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
    # Browser origin(s) allowed by CORS; comma-separate several. See cors_origins.
    frontend_url: str = "http://localhost:3000"
    # Uploaded PDFs live here; the DB stores paths relative to it. Gitignored.
    upload_dir: Path = BACKEND_DIR / "uploads"

    @property
    def cors_origins(self) -> list[str]:
        """FRONTEND_URL split on commas, plus the loopback twin of each origin. A browser treats
        http://localhost:3000 and http://127.0.0.1:3000 as different origins, so opening the app
        via the other name would otherwise fail every request with a CORS error."""
        origins: list[str] = []
        for raw in self.frontend_url.split(","):
            origin = raw.strip().rstrip("/")
            if not origin:
                continue
            twins = [origin]
            if "://localhost" in origin:
                twins.append(origin.replace("://localhost", "://127.0.0.1", 1))
            elif "://127.0.0.1" in origin:
                twins.append(origin.replace("://127.0.0.1", "://localhost", 1))
            origins += [o for o in twins if o not in origins]
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
