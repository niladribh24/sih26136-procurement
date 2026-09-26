from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.security import hash_password, verify_password
from app.models import StartupProfile, User
from app.schemas.auth import SignupRequest, UserSession

# Same message for "no such email" and "wrong password" so the endpoint can't be used
# to probe which emails have accounts.
INVALID_CREDENTIALS = "Invalid email or password"


def _email_taken() -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, detail="An account with this email already exists")


def register_user(db: Session, req: SignupRequest) -> User:
    if db.scalar(select(User.id).where(User.email == req.email)) is not None:
        raise _email_taken()

    user = User(
        role=req.role,
        name=req.name,
        org_name=req.org_name,
        department=req.department,
        email=req.email,
        password_hash=hash_password(req.password),
    )
    db.add(user)
    try:
        # flush sends the INSERT so Postgres assigns user.id, without committing yet —
        # the user row and its startup profile then commit together or not at all.
        db.flush()
        if req.role == "startup":
            db.add(StartupProfile(user_id=user.id, dpiit_number=req.dpiit_number))
        db.commit()
    except IntegrityError:
        # Two signups with the same email racing past the check above: the UNIQUE
        # constraint on users.email is the real guard.
        db.rollback()
        raise _email_taken()
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)
    return user


def build_session(db: Session, user: User, token: str) -> UserSession:
    dpiit_number = None
    if user.role == "startup":
        dpiit_number = db.scalar(
            select(StartupProfile.dpiit_number).where(StartupProfile.user_id == user.id)
        )
    return UserSession(
        id=str(user.id),
        name=user.name,
        email=user.email,
        role=user.role,
        org_name=user.org_name,
        department=user.department,
        dpiit_number=dpiit_number,
        avatar_url=user.avatar_url,
        token=token,
    )
