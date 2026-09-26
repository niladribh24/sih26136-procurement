import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import REAL, ForeignKey, Integer, Numeric, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, ENUM, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, timestamp_now, uuid_pk

problem_status = ENUM("open", "under_review", "closed", name="problem_status", create_type=False)


class Problem(Base):
    __tablename__ = "problems"

    id: Mapped[uuid.UUID] = uuid_pk()
    posted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(Text)
    domain: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    desired_outcome: Mapped[str] = mapped_column(Text)
    budget_band: Mapped[str | None] = mapped_column(Text)
    trl_expected: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str | None] = mapped_column(problem_status, server_default=text("'open'"))
    embedding: Mapped[list[float] | None] = mapped_column(ARRAY(REAL))
    created_at: Mapped[datetime | None] = timestamp_now()


class SolutionAbstract(Base):
    __tablename__ = "solution_abstracts"

    id: Mapped[uuid.UUID] = uuid_pk()
    problem_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE")
    )
    startup_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("startup_profiles.id", ondelete="CASCADE")
    )
    abstract_text: Mapped[str | None] = mapped_column(Text)
    file_path: Mapped[str | None] = mapped_column(Text)
    ai_summary: Mapped[str | None] = mapped_column(Text)
    match_score: Mapped[Decimal | None] = mapped_column(Numeric)
    rank_result: Mapped[dict[str, Any] | None] = mapped_column(JSONB)  # full /rank RankResult — see schema.sql comment
    submitted_at: Mapped[datetime | None] = timestamp_now()
