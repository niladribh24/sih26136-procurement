import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, Text, text, true
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, timestamp_now, uuid_pk

REPLICATION_STATUSES = ("pending", "approved", "in_pilot")


class ProcurementRecord(Base):
    __tablename__ = "procurement_records"

    id: Mapped[uuid.UUID] = uuid_pk()
    pilot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("pilots.id"))
    procurement_package_url: Mapped[str | None] = mapped_column(Text)
    compliance_checklist: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    status: Mapped[str | None] = mapped_column(Text, server_default=text("'pending'"))
    procured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ProvenSolution(Base):
    __tablename__ = "proven_solutions"

    id: Mapped[uuid.UUID] = uuid_pk()
    procurement_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("procurement_records.id"))
    replicable: Mapped[bool | None] = mapped_column(Boolean, server_default=true())
    replication_requests_count: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))


class ReplicationRequest(Base):
    __tablename__ = "replication_requests"
    # Mirrors the CHECK in schema.sql; the database is what actually enforces it.
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'approved', 'in_pilot')", name="replication_requests_status_check"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    proven_solution_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("proven_solutions.id", ondelete="CASCADE")
    )
    pilot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("pilots.id"))
    requesting_dept_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    requesting_officer_name: Mapped[str | None] = mapped_column(Text)
    requesting_officer_email: Mapped[str | None] = mapped_column(Text)
    target_deployment_site: Mapped[str | None] = mapped_column(Text)
    target_quantity: Mapped[int | None] = mapped_column(Integer)
    target_budget: Mapped[Decimal | None] = mapped_column(Numeric)
    deployment_timeline_weeks: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text, server_default=text("'pending'"))
    requested_at: Mapped[datetime | None] = timestamp_now()
