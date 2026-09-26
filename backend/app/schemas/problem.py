from datetime import date
from typing import Literal, Self

from pydantic import Field, field_validator, model_validator

from app.schemas.base import CamelModel
from app.schemas.common import TRL

# All mirror frontend/lib/types.ts Problem.
Domain = Literal["AgriTech", "GovTech", "Defence", "HealthTech", "CleanTech", "DroneTech"]
BudgetBand = Literal["< ₹10L", "₹10L–₹25L", "₹25L–₹50L", "> ₹50L"]
ProblemStatus = Literal["open", "evaluating", "pilot_active", "completed"]

REQUIRED_TEXT = ("title", "department", "ministry", "description", "desired_outcome")


def _strip_required(v: str | None) -> str | None:
    if v is None:
        return v
    v = v.strip()
    if not v:
        raise ValueError("Must not be blank")
    return v


class ProblemCreate(CamelModel):
    """Body of POST /api/problems — api.ts createProblem()'s argument."""

    title: str
    department: str
    ministry: str
    domain: Domain
    description: str
    desired_outcome: str
    budget_band: BudgetBand
    # to_camel would give "targetTrl"; the frontend field is "targetTRL".
    target_trl: TRL = Field(alias="targetTRL")
    deadline: date

    _strip = field_validator(*REQUIRED_TEXT)(_strip_required)

    @field_validator("deadline")
    @classmethod
    def _not_past(cls, v: date) -> date:
        if v < date.today():
            raise ValueError("Deadline can't be in the past")
        return v


class ProblemUpdate(CamelModel):
    """Body of PATCH /api/problems/:id — every field optional; only the ones sent change."""

    title: str | None = None
    department: str | None = None
    ministry: str | None = None
    domain: Domain | None = None
    description: str | None = None
    desired_outcome: str | None = None
    budget_band: BudgetBand | None = None
    target_trl: TRL | None = Field(default=None, alias="targetTRL")
    deadline: date | None = None
    status: ProblemStatus | None = None

    _strip = field_validator(*REQUIRED_TEXT)(_strip_required)

    @model_validator(mode="after")
    def _no_nulls(self) -> Self:
        # Leaving a field out means "don't change it"; sending null would blank a
        # required field, so reject that explicitly.
        nulls = [name for name in self.model_fields_set if getattr(self, name) is None]
        if nulls:
            raise ValueError(f"These fields can't be null: {', '.join(sorted(nulls))}")
        return self


class ProblemOut(CamelModel):
    """Mirrors frontend/lib/types.ts Problem exactly."""

    id: str
    code: str
    title: str
    department: str
    ministry: str
    domain: str
    description: str
    desired_outcome: str
    budget_band: str
    target_trl: str = Field(alias="targetTRL")
    deadline: str
    created_at: str
    submission_count: int
    status: ProblemStatus
