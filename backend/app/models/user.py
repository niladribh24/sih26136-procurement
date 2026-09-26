import uuid
from datetime import datetime

from sqlalchemy import Boolean, Text, false
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, timestamp_now, uuid_pk

# create_type=False: the enum type already exists (schema.sql creates it); only reference it.
user_role = ENUM("startup", "govt_officer", "admin", "evaluator", name="user_role", create_type=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_pk()
    role: Mapped[str] = mapped_column(user_role)
    name: Mapped[str] = mapped_column(Text)
    org_name: Mapped[str] = mapped_column(Text)
    department: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str] = mapped_column(Text, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    verified: Mapped[bool | None] = mapped_column(Boolean, server_default=false())
    created_at: Mapped[datetime | None] = timestamp_now()
