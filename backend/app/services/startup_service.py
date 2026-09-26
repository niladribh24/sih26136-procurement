import uuid
from typing import Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import StartupDocument, StartupProfile, User
from app.schemas.common import to_date_str
from app.schemas.startup import DocumentUploadResult, StartupDocumentOut, StartupProfileOut, StartupProfileUpdate
from app.services.uploads import STARTUP_DOCS, delete_upload, display_name, save_pdf


def get_profile(db: Session, user_id: uuid.UUID) -> StartupProfile:
    """The startup profile belonging to a user, with the user row loaded alongside (one query)."""
    profile = db.scalar(
        select(StartupProfile).options(joinedload(StartupProfile.user)).where(StartupProfile.user_id == user_id)
    )
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Startup profile not found")
    return profile


def _labels(items: list[Any] | None) -> list[str]:
    # extracted_tags/skills are empty until the ML phase, which will also settle their
    # final shape (flat strings from /extract vs. the {domain/skill, confidence} objects
    # schema.sql's comment describes). Accept both so neither breaks this endpoint.
    labels = []
    for item in items or []:
        if isinstance(item, str):
            labels.append(item)
        elif isinstance(item, dict) and (label := item.get("domain") or item.get("skill")):
            labels.append(label)
    return labels


def _document_out(doc: StartupDocument) -> StartupDocumentOut:
    return StartupDocumentOut(
        id=str(doc.id), file_name=doc.original_filename or "document.pdf", uploaded_at=to_date_str(doc.uploaded_at)
    )


def list_documents(db: Session, profile: StartupProfile) -> list[StartupDocumentOut]:
    docs = db.scalars(
        select(StartupDocument)
        .where(StartupDocument.startup_id == profile.id)
        .order_by(StartupDocument.uploaded_at.desc())
    )
    return [_document_out(d) for d in docs]


def build_profile(db: Session, profile: StartupProfile) -> StartupProfileOut:
    return StartupProfileOut(
        user_id=str(profile.user_id),
        startup_name=profile.user.org_name,
        dpiit_number=profile.dpiit_number or "",
        dpiit_verified=bool(profile.dpiit_verified),
        turnover_band=profile.turnover_band,
        location=profile.location,
        incorporation_year=profile.incorporation_year,
        description=profile.description,
        tags=_labels(profile.extracted_tags),
        skills=_labels(profile.extracted_skills),
        documents=list_documents(db, profile),
    )


def update_profile(db: Session, profile: StartupProfile, req: StartupProfileUpdate) -> None:
    # exclude_unset: a field the client didn't send is left alone; one sent as null is cleared.
    changes = req.model_dump(exclude_unset=True)

    # The startup's name is the user's org_name (what UserSession.orgName shows), not a
    # profile column, so it's written there instead.
    if "startup_name" in changes:
        user: User = profile.user
        user.org_name = changes.pop("startup_name")

    if "dpiit_number" in changes and changes["dpiit_number"] != profile.dpiit_number:
        # A new number hasn't been checked by anyone yet.
        profile.dpiit_verified = False

    for field, value in changes.items():
        setattr(profile, field, value)
    db.commit()


def add_document(db: Session, profile: StartupProfile, file: UploadFile) -> DocumentUploadResult:
    rel_path = save_pdf(file, STARTUP_DOCS)
    doc = StartupDocument(startup_id=profile.id, file_path=rel_path, original_filename=display_name(file.filename))
    db.add(doc)
    try:
        db.commit()
    except BaseException:
        # Don't leave an orphaned file on disk that no row points to.
        db.rollback()
        delete_upload(rel_path)
        raise
    db.refresh(doc)
    # ML /extract isn't called yet, so domain/tags/summary keep their empty defaults.
    return DocumentUploadResult(**_document_out(doc).model_dump())
