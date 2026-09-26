import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import REAL, Boolean, ForeignKey, Text, false, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, timestamp_now, uuid_pk


class StartupProfile(Base):
    __tablename__ = "startup_profiles"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )
    dpiit_number: Mapped[str | None] = mapped_column(Text)
    dpiit_verified: Mapped[bool | None] = mapped_column(Boolean, server_default=false())
    turnover_band: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    extracted_tags: Mapped[list[Any] | None] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    extracted_skills: Mapped[list[Any] | None] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    embedding: Mapped[list[float] | None] = mapped_column(ARRAY(REAL))
    created_at: Mapped[datetime | None] = timestamp_now()


class StartupDocument(Base):
    __tablename__ = "startup_documents"

    id: Mapped[uuid.UUID] = uuid_pk()
    startup_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("startup_profiles.id", ondelete="CASCADE")
    )
    file_path: Mapped[str] = mapped_column(Text)
    extracted_text: Mapped[str | None] = mapped_column(Text)
    uploaded_at: Mapped[datetime | None] = timestamp_now()
