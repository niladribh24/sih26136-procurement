import re
from typing import Literal, Self

from pydantic import Field, field_validator, model_validator

from app.schemas.base import CamelModel

# Same rule as frontend/app/(auth)/signup/page.tsx.
DPIIT_RE = re.compile(r"^(DIPP|DPIIT)\d{5}$")
# Deliberately loose — just catches obvious typos without pulling in email-validator.
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

UserRole = Literal["startup", "govt_officer", "evaluator", "admin"]


def _normalize_email(v: str) -> str:
    v = v.strip().lower()
    if not EMAIL_RE.match(v):
        raise ValueError("Invalid email address")
    return v


class SignupRequest(CamelModel):
    # admin is intentionally absent: admins are created out-of-band, never self-registered.
    role: Literal["startup", "govt_officer", "evaluator"]
    name: str = Field(min_length=1)
    org_name: str = Field(min_length=1)
    email: str
    password: str = Field(min_length=8)
    department: str | None = None
    dpiit_number: str | None = None

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _normalize_email(v)

    @field_validator("name", "org_name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Must not be blank")
        return v

    @field_validator("password")
    @classmethod
    def _bcrypt_limit(cls, v: str) -> str:
        if len(v.encode()) > 72:
            raise ValueError("Password must be at most 72 bytes")
        return v

    @model_validator(mode="after")
    def _role_fields(self) -> Self:
        if self.role == "startup":
            dpiit = (self.dpiit_number or "").strip().upper()
            if not DPIIT_RE.match(dpiit):
                raise ValueError("Startups need a valid DPIIT number (e.g. DIPP84920 or DPIIT12345)")
            self.dpiit_number = dpiit
            self.department = None
        else:
            dept = (self.department or "").strip()
            if not dept:
                raise ValueError("Government officers and evaluators need a department")
            self.department = dept
            self.dpiit_number = None
        return self


class LoginRequest(CamelModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _normalize_email(v)


class UserSession(CamelModel):
    """Mirrors UserSession in frontend/lib/types.ts. Never carries the password hash."""

    id: str
    name: str
    email: str
    role: UserRole
    org_name: str
    department: str | None = None
    dpiit_number: str | None = None
    avatar_url: str | None = None
    token: str
