"""Pilot and Milestone shapes — frontend/lib/types.ts Pilot / Milestone exactly."""

from decimal import Decimal
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.schemas.base import CamelModel

# frontend/lib/types.ts PilotStatus (display labels on the wire; the DB stores the enum value).
PilotStatusLabel = Literal[
    "Proposed",
    "Under review",
    "Approved",
    "Active",
    "Completed",
    "Failed",
    "Recommended for procurement",
    "Procured",
]
MilestoneStatus = Literal["pending", "submitted", "verified", "failed"]


class MilestoneOut(CamelModel):
    id: str
    pilot_id: str
    sequence: int
    title: str
    description: str
    target_kpi: str = Field(alias="targetKPI")
    achieved_kpi: str | None = Field(default=None, alias="achievedKPI")
    deliverable_due_week: int
    deliverable_file_url: str | None = None
    tranche_amount: float
    tranche_percentage: float
    status: MilestoneStatus
    tranche_disbursed: bool | None = None
    disbursed_at: str | None = None
    verified_by: str | None = None
    verified_at: str | None = None
    verification_remarks: str | None = None
    verification_report_url: str | None = None


class PilotOut(CamelModel):
    id: str
    code: str
    problem_id: str
    solution_id: str
    startup_id: str  # the startup's *user* id, like Solution.startupId
    startup_name: str
    dpiit_number: str
    dpiit_verified: bool | None = None
    department: str
    ministry: str
    lead_officer_name: str
    independent_validator_name: str
    status: PilotStatusLabel
    duration_weeks: int
    start_date: str
    completion_date: str | None = None
    total_budget: float
    milestones: list[MilestoneOut]
    # Only once the pilot is Procured: the procurement_records id and a reference derived from it.
    sanction_docket_id: str | None = None
    sanction_order_ref: str | None = None
    # 0-100, see pilot_service.performance_score(); omitted until a milestone is verified.
    performance_score: float | None = None


class MilestoneCreate(CamelModel):
    sequence: int = Field(ge=1)
    title: str = Field(min_length=1)
    description: str = ""
    target_kpi: str = Field(default="", alias="targetKPI")
    deliverable_due_week: int = Field(ge=1)
    tranche_percentage: Decimal = Field(gt=0, le=100)


class PilotCreate(CamelModel):
    """POST /api/pilots. api.ts createPilot sends the whole Pilot-minus-server-fields object;
    only these are read. Problem, startup, department, lead officer etc. come from the
    solution server-side, and trancheAmount is computed from totalBudget."""

    solution_id: str
    independent_validator_name: str = Field(min_length=1)
    duration_weeks: int = Field(ge=1, le=260)
    total_budget: Decimal = Field(gt=0)
    milestones: list[MilestoneCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def _check_milestones(self) -> "PilotCreate":
        total = sum(m.tranche_percentage for m in self.milestones)
        if total != 100:
            raise ValueError(f"Milestone tranche percentages must add up to 100 (got {total})")
        for m in self.milestones:
            if m.deliverable_due_week > self.duration_weeks:
                raise ValueError(
                    f"Milestone {m.sequence} is due in week {m.deliverable_due_week}, "
                    f"after the pilot ends (week {self.duration_weeks})"
                )
        if len({m.sequence for m in self.milestones}) != len(self.milestones):
            raise ValueError("Milestone sequence numbers must be unique")
        return self


class PilotStatusUpdate(CamelModel):
    status: PilotStatusLabel


class DeliverableSubmit(CamelModel):
    achieved_kpi: str = Field(alias="achievedKPI")
    file_url: str

    @field_validator("achieved_kpi", "file_url")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Must not be blank")
        return v


class MilestoneVerify(CamelModel):
    verified_by: str = Field(min_length=1)  # the validator's display name
    remarks: str = ""
    status: Literal["verified", "failed"] = "verified"
    verification_report_url: str | None = None


class AuditEntryIn(CamelModel):
    """POST /api/pilots/:id/audit — api.ts logAuditEntry() (pilotId comes from the URL)."""

    action: str = Field(min_length=1)
    actor_name: str = ""
    actor_role: str = ""
    hash: str | None = None
