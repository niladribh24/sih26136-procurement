from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.auth.dependencies import bearer_scheme, get_current_user
from app.auth.security import create_access_token
from app.database import get_db
from app.models import User
from app.schemas.auth import LoginRequest, SignupRequest, UserSession
from app.services.auth_service import authenticate, build_session, register_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

# by_alias → camelCase keys; exclude_none → optional fields are omitted, like the TS `?:`.
SESSION_RESPONSE = {"response_model": UserSession, "response_model_by_alias": True, "response_model_exclude_none": True}


@router.post("/signup", status_code=status.HTTP_201_CREATED, **SESSION_RESPONSE)
def signup(req: SignupRequest, db: Session = Depends(get_db)) -> UserSession:
    user = register_user(db, req)
    return build_session(db, user, create_access_token(user.id, user.role))


@router.post("/login", **SESSION_RESPONSE)
def login(req: LoginRequest, db: Session = Depends(get_db)) -> UserSession:
    user = authenticate(db, req.email, req.password)
    return build_session(db, user, create_access_token(user.id, user.role))


@router.get("/me", **SESSION_RESPONSE)
def me(
    user: User = Depends(get_current_user),
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> UserSession:
    # get_current_user already rejected a missing/invalid token, so creds is set here.
    return build_session(db, user, creds.credentials)
