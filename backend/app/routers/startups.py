import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.auth import GOV_ROLES, get_current_user, require_role
from app.database import get_db
from app.models import User
from app.schemas.startup import DocumentUploadResult, StartupDocumentOut, StartupProfileOut, StartupProfileUpdate
from app.services.startup_service import add_document, build_profile, get_profile, list_documents, update_profile

router = APIRouter(prefix="/api/startups", tags=["startups"])

startup_only = require_role("startup")


# exclude_none: optional fields with no value are omitted, like the TS `?:` (same as auth).
@router.get("/me", response_model=StartupProfileOut, response_model_exclude_none=True)
def my_profile(user: User = Depends(startup_only), db: Session = Depends(get_db)) -> StartupProfileOut:
    return build_profile(db, get_profile(db, user.id))


@router.patch("/me", response_model=StartupProfileOut, response_model_exclude_none=True)
def edit_my_profile(
    req: StartupProfileUpdate, user: User = Depends(startup_only), db: Session = Depends(get_db)
) -> StartupProfileOut:
    profile = get_profile(db, user.id)
    update_profile(db, profile, req)
    return build_profile(db, profile)


@router.post("/me/documents", status_code=status.HTTP_201_CREATED, response_model=DocumentUploadResult)
def upload_document(
    file: UploadFile = File(), user: User = Depends(startup_only), db: Session = Depends(get_db)
) -> DocumentUploadResult:
    return add_document(db, get_profile(db, user.id), file)


@router.get("/me/documents", response_model=list[StartupDocumentOut])
def my_documents(user: User = Depends(startup_only), db: Session = Depends(get_db)) -> list[StartupDocumentOut]:
    return list_documents(db, get_profile(db, user.id))


@router.get("/{user_id}", response_model=StartupProfileOut, response_model_exclude_none=True)
def startup_profile(
    user_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> StartupProfileOut:
    # Government-side roles browse startups; a startup may only view itself here.
    if user.role not in GOV_ROLES and user.id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Insufficient role")
    return build_profile(db, get_profile(db, user_id))
