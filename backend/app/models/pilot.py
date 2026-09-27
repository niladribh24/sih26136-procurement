import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, Text, false, text
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, timestamp_now, uuid_pk

if TYPE_CHECKING:
    from app.models.problem import Problem, SolutionAbstract
    from app.models.startup import StartupProfile

pilot_status = ENUM(
    "proposed", "under_review", "approved", "active", "completed", "failed", "recommended_for_procurement",
    "procured",
    name="pilot_status",
    create_type=False,
)
milestone_status = ENUM("pending", "submitted", "verified", "failed", name="milestone_status", create_type=False)

# Mirrors the column DEFAULT in schema.sql; Postgres fills it in, the ORM never writes it.
PILOT_CODE_DEFAULT = "('PLT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('pilot_code_seq')::text, 3, '0'))"


class Pilot(Base):
    __tablename__ = "pilots"

    id: Mapped[uuid.UUID] = uuid_pk()
    code: Mapped[str] = mapped_column(Text, unique=True, server_default=text(PILOT_CODE_DEFAULT))
    problem_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("problems.id"))
    startup_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("startup_profiles.id"))
    solution_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("solution_abstracts.id"), unique=True
    )
    independent_validator_name: Mapped[str | None] = mapped_column(Text)
    objective: Mapped[str | None] = mapped_column(Text)
    success_metrics: Mapped[list[Any] | None] = mapped_column(JSONB)
    # Only app/services/pilot_state_machine.py may change this.
    status: Mapped[str | None] = mapped_column(pilot_status, server_default=text("'proposed'"))
    budget_cap: Mapped[Decimal | None] = mapped_column(Numeric)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    failed_milestones_count: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
    created_at: Mapped[datetime | None] = timestamp_now()

    problem: Mapped["Problem"] = relationship()
    startup: Mapped["StartupProfile"] = relationship()
    solution: Mapped["SolutionAbstract"] = relationship()
    milestones: Mapped[list["PilotMilestone"]] = relationship(order_by="PilotMilestone.sequence")


class PilotMilestone(Base):
    __tablename__ = "pilot_milestones"

    id: Mapped[uuid.UUID] = uuid_pk()
    pilot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("pilots.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(Text)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str | None] = mapped_column(milestone_status, server_default=text("'pending'"))
    sequence: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)
    target_kpi: Mapped[str | None] = mapped_column(Text)
    achieved_kpi: Mapped[str | None] = mapped_column(Text)
    evidence_url: Mapped[str | None] = mapped_column(Text)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    tranche_amount: Mapped[Decimal | None] = mapped_column(Numeric)
    tranche_percentage: Mapped[Decimal | None] = mapped_column(Numeric)
    tranche_disbursed: Mapped[bool | None] = mapped_column(Boolean, server_default=false())
    disbursed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verified_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    verified_by_name: Mapped[str | None] = mapped_column(Text)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verification_remarks: Mapped[str | None] = mapped_column(Text)
    verification_report_url: Mapped[str | None] = mapped_column(Text)


class PilotStatusHistory(Base):
    __tablename__ = "pilot_status_history"

    id: Mapped[uuid.UUID] = uuid_pk()
    pilot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pilots.id", ondelete="CASCADE"))
    from_status: Mapped[str | None] = mapped_column(pilot_status)
    to_status: Mapped[str] = mapped_column(pilot_status)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    changed_at: Mapped[datetime | None] = timestamp_now()


class AuditEntry(Base):
    __tablename__ = "audit_entries"

    id: Mapped[uuid.UUID] = uuid_pk()
    pilot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pilots.id", ondelete="CASCADE"))
    action: Mapped[str] = mapped_column(Text)
    actor_name: Mapped[str | None] = mapped_column(Text)
    actor_role: Mapped[str | None] = mapped_column(Text)
    hash: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime | None] = timestamp_now()
