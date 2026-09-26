import uuid
from datetime import timedelta

import pytest
from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.auth import require_role
from app.auth.security import create_access_token, decode_token
from app.main import app
from app.models import StartupProfile, User
from tests.helpers import PASSWORD, auth, signup, signup_body

SESSION_KEYS = {"id", "name", "email", "role", "orgName", "department", "dpiitNumber", "avatarUrl", "token"}


# Throwaway route that exists only while the tests run — proves require_role works
# without shipping a demo endpoint in the real app.
@app.get("/test/officer-only")
def _officer_only(user: User = Depends(require_role("govt_officer"))):
    return {"ok": True, "role": user.role}


# ---------- signup ----------

def test_signup_startup_returns_session_and_creates_profile(client, db):
    body = signup_body("startup")
    res = client.post("/api/auth/signup", json=body)

    assert res.status_code == 201
    data = res.json()
    assert set(data) <= SESSION_KEYS
    assert data["email"] == body["email"]
    assert data["role"] == "startup"
    assert data["orgName"] == body["orgName"]
    assert data["dpiitNumber"] == "DIPP12345"  # normalized to uppercase
    assert "department" not in data
    assert decode_token(data["token"])["sub"] == data["id"]

    profile = db.scalar(select(StartupProfile).where(StartupProfile.user_id == uuid.UUID(data["id"])))
    assert profile is not None and profile.dpiit_number == "DIPP12345"


def test_one_startup_profile_per_user(client, db):
    data = signup(client)
    db.add(StartupProfile(user_id=uuid.UUID(data["id"]), dpiit_number="DIPP99999"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_signup_never_returns_password(client):
    data = signup(client)
    assert not any("password" in k.lower() for k in data)
    assert PASSWORD not in str(data)


def test_signup_stores_bcrypt_hash_not_plaintext(client, db):
    data = signup(client)
    user = db.get(User, uuid.UUID(data["id"]))
    assert user.password_hash != PASSWORD
    assert user.password_hash.startswith("$2")


@pytest.mark.parametrize("role", ["govt_officer", "evaluator"])
def test_signup_officer_has_department_no_dpiit(client, role):
    data = signup(client, role)
    assert data["role"] == role
    assert data["department"] == "Division of Testing"
    assert "dpiitNumber" not in data


@pytest.mark.parametrize(
    "role, overrides",
    [
        ("admin", {}),                             # admins can't self-register
        ("startup", {"dpiitNumber": None}),        # startup without DPIIT
        ("startup", {"dpiitNumber": "12345"}),     # bad DPIIT format
        ("govt_officer", {"department": "  "}),    # officer without department
        ("startup", {"password": "short"}),        # too short
        ("startup", {"email": "not-an-email"}),
    ],
)
def test_signup_validation_errors(client, role, overrides):
    res = client.post("/api/auth/signup", json=signup_body(role, **overrides))
    assert res.status_code == 422, res.text


def test_signup_duplicate_email_409(client):
    body = signup_body()
    assert client.post("/api/auth/signup", json=body).status_code == 201

    res = client.post("/api/auth/signup", json={**body, "email": body["email"].upper()})
    assert res.status_code == 409


# ---------- login ----------

def test_login_returns_full_session(client):
    created = signup(client, "govt_officer")

    res = client.post("/api/auth/login", json={"email": created["email"], "password": PASSWORD})
    assert res.status_code == 200
    data = res.json()
    assert {k: v for k, v in data.items() if k != "token"} == {k: v for k, v in created.items() if k != "token"}
    assert decode_token(data["token"])["sub"] == created["id"]


def test_login_startup_includes_dpiit(client):
    created = signup(client, "startup")
    res = client.post("/api/auth/login", json={"email": created["email"], "password": PASSWORD})
    assert res.json()["dpiitNumber"] == "DIPP12345"


def test_login_wrong_password_401(client):
    created = signup(client)
    res = client.post("/api/auth/login", json={"email": created["email"], "password": "wrong-password"})
    assert res.status_code == 401


def test_login_unknown_email_401(client):
    res = client.post("/api/auth/login", json={"email": "nobody-xyz@example.com", "password": PASSWORD})
    assert res.status_code == 401


# ---------- /me and tokens ----------

def test_me_returns_current_user(client):
    created = signup(client)
    res = client.get("/api/auth/me", headers=auth(created["token"]))
    assert res.status_code == 200
    assert res.json() == created


def test_me_without_token_401(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401
    assert res.headers["www-authenticate"] == "Bearer"


def test_me_garbage_token_401(client):
    assert client.get("/api/auth/me", headers=auth("not.a.jwt")).status_code == 401


def test_me_expired_token_401(client):
    created = signup(client)
    expired = create_access_token(uuid.UUID(created["id"]), "startup", expires_delta=timedelta(seconds=-1))
    res = client.get("/api/auth/me", headers=auth(expired))
    assert res.status_code == 401
    assert res.json()["detail"] == "Token expired"


# ---------- require_role ----------

def test_role_route_allows_matching_role(client):
    officer = signup(client, "govt_officer")
    res = client.get("/test/officer-only", headers=auth(officer["token"]))
    assert res.status_code == 200
    assert res.json() == {"ok": True, "role": "govt_officer"}


def test_role_route_forbids_other_role(client):
    startup = signup(client, "startup")
    assert client.get("/test/officer-only", headers=auth(startup["token"])).status_code == 403


def test_role_route_requires_token(client):
    assert client.get("/test/officer-only").status_code == 401
