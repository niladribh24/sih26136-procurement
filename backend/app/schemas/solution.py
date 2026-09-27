from decimal import Decimal
from typing import Literal

from pydantic import Field, field_validator

from app.schemas.base import CamelModel
from app.schemas.common import TRL

# frontend/lib/types.ts Solution.status
SolutionStatus = Literal["submitted", "under_review", "shortlisted", "rejected"]


class SolutionSubmit(CamelModel):
    """The text fields of POST /api/problems/:id/solutions, sent as multipart form data
    next to the PDF. Everything else on api.ts submitSolution()'s argument (startupName,
    dpiitNumber, dpiitVerified, location, startupId) is read from the caller's own profile —
    never trusted from the request, or a startup could claim to be DPIIT-verified."""

    title: str
    abstract: str
    claimed_trl: TRL = Field(alias="claimedTRL")
    proposed_cost: Decimal = Field(gt=0)
    proposed_duration_weeks: int = Field(gt=0)

    @field_validator("title", "abstract")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Must not be blank")
        return v


class RubricIn(CamelModel):
    """POST /api/solutions/:id/rubric. The maxima are the 30/20/20/30 scale in types.ts."""

    technical_merit: Decimal = Field(ge=0, le=30)
    cost_realism: Decimal = Field(ge=0, le=20)
    team_capability: Decimal = Field(ge=0, le=20)
    timeline_viability: Decimal = Field(ge=0, le=30)
    comments: str | None = None


class RubricScore(CamelModel):
    technical_merit: float  # /30
    cost_realism: float  # /20
    team_capability: float  # /20
    timeline_viability: float  # /30
    total: float


class SolutionOut(CamelModel):
    """Mirrors frontend/lib/types.ts Solution exactly."""

    id: str
    problem_id: str
    startup_id: str  # the startup's *user* id — the frontend compares it to session.id
    startup_name: str
    dpiit_number: str
    dpiit_verified: bool
    location: str
    title: str
    abstract: str
    claimed_trl: str = Field(alias="claimedTRL")
    proposed_cost: float
    proposed_duration_weeks: int
    submitted_at: str
    # Pending until the ML phase fills rank_result: 0 / "" / [].
    match_score: float
    match_explanation: str
    matched_keywords: list[str]
    pdf_url: str
    status: SolutionStatus
    rubric_score: RubricScore | None = None


class SolutionStatusUpdate(CamelModel):
    status: SolutionStatus
