"""GET/POST /api/solutions/:id/eligibility. There's no frontend/lib/types.ts equivalent yet,
so this shape is defined in backend/docs/api_contract.md."""

from typing import Literal

from app.schemas.base import CamelModel


class RuleOut(CamelModel):
    rule: str  # "dpiit" | "turnover" | "domain" | "trl"
    label: str
    status: Literal["pass", "fail", "pending"]
    reason: str


class EligibilityOut(CamelModel):
    solution_id: str
    status: Literal["eligible", "ineligible", "pending"]
    overall_eligible: bool | None  # eligibility_checks.overall_eligible; null while pending
    checked_at: str  # ISO 8601 timestamp
    rules: list[RuleOut]
