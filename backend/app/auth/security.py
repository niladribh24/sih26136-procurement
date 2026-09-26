"""Password hashing and JWT issue/verify.

Uses the `bcrypt` library directly rather than passlib (unmaintained, breaks on bcrypt>=4.1).
bcrypt only reads the first 72 bytes of a password — SignupRequest caps length there so a
longer password can't silently collide with its 72-byte prefix.
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.config import get_settings

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_access_token(user_id: uuid.UUID, role: str, expires_delta: timedelta | None = None) -> str:
    settings = get_settings()
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=settings.jwt_expire_minutes))
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """Raises jwt.ExpiredSignatureError / jwt.InvalidTokenError on a bad token."""
    return jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM], options={"require": ["exp", "sub"]})
