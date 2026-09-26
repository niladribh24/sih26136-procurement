"""Reusable FastAPI dependencies for protecting endpoints.

    @router.get("/thing")
    def thing(user: User = Depends(get_current_user)): ...

    @router.post("/problems")
    def create(user: User = Depends(require_role("govt_officer", "admin"))): ...
"""

import uuid
from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import decode_token
from app.database import get_db
from app.models import User

# auto_error=False so a missing header reaches us and we return 401 (the spec-correct
# status), rather than whatever HTTPBearer's built-in error happens to be.
bearer_scheme = HTTPBearer(auto_error=False)

# The roles that share the /gov dashboard tree in the frontend.
GOV_ROLES = ("govt_officer", "evaluator", "admin")


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"})


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise _unauthorized("Not authenticated")
    try:
        payload = decode_token(creds.credentials)
        user_id = uuid.UUID(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Token expired")
    except (jwt.InvalidTokenError, ValueError):
        raise _unauthorized("Invalid token")

    # Reload from the DB rather than trusting the token's role claim, so a deleted user
    # or a changed role takes effect immediately instead of when the token expires.
    user = db.get(User, user_id)
    if user is None:
        raise _unauthorized("Invalid token")
    return user


def require_role(*roles: str) -> Callable[..., User]:
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user

    return dependency
