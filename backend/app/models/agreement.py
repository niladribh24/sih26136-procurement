import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Numeric, Text, false
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, timestamp_now, uuid_pk


class IpAgreement(Base):
    __tablename__ = "ip_agreements"

    id: Mapped[uuid.UUID] = uuid_pk()
    pilot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("pilots.id", ondelete="CASCADE"))
    ip_clause_type: Mapped[str | None] = mapped_column(Text)
    data_sharing_terms: Mapped[str | None] = mapped_column(Text)
    cybersecurity_clause: Mapped[str | None] = mapped_column(Text)
    risk_clause: Mapped[str | None] = mapped_column(Text)
    signed_by_startup: Mapped[bool | None] = mapped_column(Boolean, server_default=false())
    signed_by_dept: Mapped[bool | None] = mapped_column(Boolean, server_default=false())
    created_at: Mapped[datetime | None] = timestamp_now()


class KpiLog(Base):
    __tablename__ = "kpi_logs"

    id: Mapped[uuid.UUID] = uuid_pk()
    pilot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("pilots.id", ondelete="CASCADE"))
    metric_name: Mapped[str | None] = mapped_column(Text)
    target_value: Mapped[Decimal | None] = mapped_column(Numeric)
    actual_value: Mapped[Decimal | None] = mapped_column(Numeric)
    logged_at: Mapped[datetime | None] = timestamp_now()


class Validation(Base):
    __tablename__ = "validations"

    id: Mapped[uuid.UUID] = uuid_pk()
    pilot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("pilots.id", ondelete="CASCADE"))
    validated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    outcome: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    validated_at: Mapped[datetime | None] = timestamp_now()
