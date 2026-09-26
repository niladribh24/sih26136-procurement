from datetime import date
from typing import Literal, Self

from pydantic import Field, field_validator, model_validator

from app.schemas.auth import DPIIT_RE
from app.schemas.base import CamelModel

# The options on frontend/app/(dashboard)/startup/profile/page.tsx. Kept to a fixed set
# because the eligibility engine will compare against these exact values.
TurnoverBand = Literal["< ₹1Cr", "₹1Cr–₹5Cr", "₹5Cr–₹25Cr", "> ₹25Cr"]

# There's no StartupProfile type in frontend/lib/types.ts; these shapes follow what the
# profile page edits and displays.


# "pending": the ML service was unreachable; retry_ml.py fills it in later.
ExtractionStatus = Literal["done", "pending"]


class StartupDocumentOut(CamelModel):
    id: str
    file_name: str
    uploaded_at: str
    extraction_status: ExtractionStatus


class DocumentUploadResult(StartupDocumentOut):
    """POST /api/startups/me/documents. domain/tags/summary are the shape of api.ts
    extractDocumentTags(); all four ML fields are empty while extractionStatus is "pending"."""

    domain: str = ""
    tags: list[str] = []
    skills: list[str] = []
    summary: str = ""


class StartupProfileOut(CamelModel):
    user_id: str
    startup_name: str
    dpiit_number: str
    dpiit_verified: bool
    domain: str | None = None  # ML-classified, from the most confident document
    turnover_band: str | None = None
    location: str | None = None
    incorporation_year: int | None = None
    description: str | None = None
    tags: list[str]
    skills: list[str]
    documents: list[StartupDocumentOut]


class StartupProfileUpdate(CamelModel):
    """PATCH /api/startups/me — only the fields sent change. Send null to clear an optional field."""

    startup_name: str | None = None
    dpiit_number: str | None = None
    turnover_band: TurnoverBand | None = None
    location: str | None = None
    incorporation_year: int | None = Field(default=None, ge=1900)
    description: str | None = None

    @field_validator("startup_name", "location", "description")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return v.strip() if v is not None else v

    @field_validator("dpiit_number")
    @classmethod
    def _dpiit(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().upper()
        if not DPIIT_RE.match(v):
            raise ValueError("Invalid DPIIT number (e.g. DIPP84920 or DPIIT12345)")
        return v

    @field_validator("incorporation_year")
    @classmethod
    def _not_future(cls, v: int | None) -> int | None:
        if v is not None and v > date.today().year:
            raise ValueError("Incorporation year can't be in the future")
        return v

    @model_validator(mode="after")
    def _required_stay_set(self) -> Self:
        # startupName (users.org_name) and dpiitNumber can change but never be removed.
        for name in ("startup_name", "dpiit_number"):
            if name in self.model_fields_set and not getattr(self, name):
                raise ValueError(f"{name} can't be empty")
        return self
