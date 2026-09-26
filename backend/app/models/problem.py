import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import REAL, Date, ForeignKey, Integer, Numeric, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import ARRAY, ENUM, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, timestamp_now, uuid_pk

if TYPE_CHECKING:
    from app.models.startup import StartupProfile

problem_status = ENUM("open", "evaluating", "pilot_active", "completed", name="problem_status", create_type=False)
solution_status = ENUM(
    "submitted", "under_review", "shortlisted", "rejected", name="solution_status", create_type=False
)

# Mirrors the column DEFAULT in schema.sql; Postgres fills it in, the ORM never writes it.
PROBLEM_CODE_DEFAULT = "('PRB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('problem_code_seq')::text, 3, '0'))"


class Problem(Base):
    __tablename__ = "problems"

    id: Mapped[uuid.UUID] = uuid_pk()
    posted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    code: Mapped[str] = mapped_column(Text, unique=True, server_default=text(PROBLEM_CODE_DEFAULT))
    title: Mapped[str] = mapped_column(Text)
    department: Mapped[str | None] = mapped_column(Text)
    ministry: Mapped[str | None] = mapped_column(Text)
    domain: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    desired_outcome: Mapped[str] = mapped_column(Text)
    budget_band: Mapped[str | None] = mapped_column(Text)
    trl_expected: Mapped[int | None] = mapped_column(Integer)
    deadline: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str | None] = mapped_column(problem_status, server_default=text("'open'"))
    embedding: Mapped[list[float] | None] = mapped_column(ARRAY(REAL))
    created_at: Mapped[datetime | None] = timestamp_now()


class SolutionAbstract(Base):
    __tablename__ = "solution_abstracts"
    __table_args__ = (UniqueConstraint("problem_id", "startup_id", name="solution_abstracts_problem_startup_key"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    problem_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE")
    )
    startup_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("startup_profiles.id", ondelete="CASCADE")
    )
    title: Mapped[str | None] = mapped_column(Text)
    abstract_text: Mapped[str | None] = mapped_column(Text)
    claimed_trl: Mapped[int | None] = mapped_column(Integer)
    proposed_cost: Mapped[Decimal | None] = mapped_column(Numeric)
    proposed_duration_weeks: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str | None] = mapped_column(solution_status, server_default=text("'submitted'"))
    file_path: Mapped[str | None] = mapped_column(Text)
    ai_summary: Mapped[str | None] = mapped_column(Text)
    summary_result: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # full /summarize response; NULL = pending
    match_score: Mapped[Decimal | None] = mapped_column(Numeric)
    rank_result: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # full /rank RankResult — see schema.sql comment
    submitted_at: Mapped[datetime | None] = timestamp_now()

    problem: Mapped["Problem"] = relationship()
    startup: Mapped["StartupProfile"] = relationship()
