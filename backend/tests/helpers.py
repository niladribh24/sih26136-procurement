"""Helpers shared by the endpoint tests (plain functions, not fixtures)."""

import uuid
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.auth.security import create_access_token, hash_password
from app.models import User

PASSWORD = "correct-horse-battery"
PDF_BYTES = b"%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n"


def signup_body(role: str = "startup", **overrides) -> dict:
    body = {
        "role": role,
        "name": "Test User",
        "orgName": f"Test Org {uuid.uuid4().hex[:6]}",
        "email": f"test-{uuid.uuid4().hex[:10]}@example.com",
        "password": PASSWORD,
    }
    if role == "startup":
        body["dpiitNumber"] = "dipp12345"
    else:
        body["department"] = "Division of Testing"
    body.update(overrides)
    return body


def signup(client, role: str = "startup", **overrides) -> dict:
    res = client.post("/api/auth/signup", json=signup_body(role, **overrides))
    assert res.status_code == 201, res.text
    return res.json()


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def make_admin(db: Session) -> dict:
    """Admins can't self-register, so insert one directly. Returns auth headers."""
    user = User(
        role="admin",
        name="Admin",
        org_name="Platform",
        email=f"admin-{uuid.uuid4().hex[:10]}@example.com",
        password_hash=hash_password(PASSWORD),
    )
    db.add(user)
    db.flush()
    return auth(create_access_token(user.id, "admin"))


def problem_body(**overrides) -> dict:
    body = {
        "title": "Canopy-penetrating UAV surveillance",
        "department": "Division of Remote Sensing",
        "ministry": "Ministry of Defence",
        "domain": "DroneTech",
        "description": "Detect ground movement beneath dense foliage.",
        "desiredOutcome": "95% detection rate in field trials.",
        "budgetBand": "₹25L–₹50L",
        "targetTRL": "TRL-6",
        "deadline": (date.today() + timedelta(days=30)).isoformat(),
    }
    body.update(overrides)
    return body


def create_problem(client, officer_token: str, **overrides) -> dict:
    res = client.post("/api/problems", json=problem_body(**overrides), headers=auth(officer_token))
    assert res.status_code == 201, res.text
    return res.json()


def solution_form(**overrides) -> dict:
    form = {
        "title": "Multispectral canopy UAV",
        "abstract": "SWIR imaging with on-board edge inference.",
        "claimedTRL": "TRL-6",
        "proposedCost": "2850000",
        "proposedDurationWeeks": "8",
    }
    form.update(overrides)
    return form


def pdf_file(content: bytes = PDF_BYTES, name: str = "proposal.pdf") -> dict:
    return {"file": (name, content, "application/pdf")}


def submit_solution(client, startup_token: str, problem_id: str, **overrides) -> dict:
    res = client.post(
        f"/api/problems/{problem_id}/solutions",
        data=solution_form(**overrides),
        files=pdf_file(),
        headers=auth(startup_token),
    )
    assert res.status_code == 201, res.text
    return res.json()
