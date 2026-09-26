import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, Text, false, text
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, timestamp_now, uuid_pk

pilot_status = ENUM(
    "proposed", "under_review", "approved", "active", "completed", "failed", "recommended_for_procurement",
    name="pilot_status",
    create_type=False,
)
milestone_status = ENUM("pending", "submitted", "verified", "failed", name="milestone_status", create_type=False)


class Pilot(Base):
    __tablename__ = "pilots"

    id: Mapped[uuid.UUID] = uuid_pk()
    problem_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("problems.id"))
    startup_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("startup_profiles.id"))
    objective: Mapped[str | None] = mapped_column(Text)
    success_metrics: Mapped[list[Any] | None] = mapped_column(JSONB)
    status: Mapped[str | None] = mapped_column(pilot_status, server_default=text("'proposed'"))
    budget_cap: Mapped[Decimal | None] = mapped_column(Numeric)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    failed_milestones_count: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
    created_at: Mapped[datetime | None] = timestamp_now()


class PilotMilestone(Base):
    __tablename__ = "pilot_milestones"

    id: Mapped[uuid.UUID] = uuid_pk()
    pilot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("pilots.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(Text)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str | None] = mapped_column(milestone_status, server_default=text("'pending'"))
    evidence_url: Mapped[str | None] = mapped_column(Text)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    tranche_amount: Mapped[Decimal | None] = mapped_column(Numeric)
    tranche_percentage: Mapped[Decimal | None] = mapped_column(Numeric)
    tranche_disbursed: Mapped[bool | None] = mapped_column(Boolean, server_default=false())
    disbursed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
