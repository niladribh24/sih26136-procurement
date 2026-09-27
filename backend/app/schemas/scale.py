"""Scale & replication shapes — frontend/lib/types.ts ScaleSolution / ReplicationRequest exactly."""

from decimal import Decimal
from typing import Literal

from pydantic import Field, field_validator

from app.schemas.base import CamelModel

ReplicationStatus = Literal["pending", "approved", "in_pilot"]


class ScaleSolutionOut(CamelModel):
    id: str  # the *pilot's* id, so ReplicationRequest.pilotId = scaleSolution.id (see api_contract.md)
    pilot_code: str
    title: str
    domain: str
    startup_name: str
    dpiit_number: str
    originating_department: str
    validation_date: str
    performance_score: float
    deployed_units: int  # 1 (the original pilot) + replications that reached in_pilot
    budget_per_unit: str  # the pilot's sanctioned budget per deployment, e.g. "₹38,00,000"
    total_budget: float | None = None
    summary: str
    gfr_exemption_clause: str


class ReplicationRequestOut(CamelModel):
    id: str
    pilot_id: str
    solution_title: str
    startup_name: str
    originating_department: str
    requesting_department: str
    requesting_officer_name: str
    requesting_officer_email: str
    target_deployment_site: str
    target_quantity: int
    target_budget: float | None = None
    deployment_timeline_weeks: int | None = None
    requested_at: str
    status: ReplicationStatus


class ReplicationCreate(CamelModel):
    """POST /api/replications. solutionTitle / startupName / originatingDepartment /
    requestingDepartment that api.ts also sends are ignored: they're joined at read time."""

    pilot_id: str  # pilot id or code (ScaleSolution.id is the pilot id)
    requesting_officer_name: str = Field(min_length=1)
    requesting_officer_email: str = Field(min_length=3)
    target_deployment_site: str = Field(min_length=1)
    target_quantity: int = Field(gt=0)
    target_budget: Decimal | None = Field(default=None, gt=0)
    deployment_timeline_weeks: int | None = Field(default=None, gt=0)

    @field_validator("requesting_officer_name", "target_deployment_site")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Must not be blank")
        return v

    @field_validator("requesting_officer_email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v:
            raise ValueError("Must be an email address")
        return v


class ReplicationStatusUpdate(CamelModel):
    status: ReplicationStatus
