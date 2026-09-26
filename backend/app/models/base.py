"""Declarative base and column helpers shared by every model.

These models only *map* onto tables that backend/schema.sql creates. Never call
Base.metadata.create_all() — schema.sql is the single source of DDL. server_default
values below mirror the SQL DEFAULTs so the ORM knows the database fills them in.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))


def timestamp_now() -> Mapped[datetime | None]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())
