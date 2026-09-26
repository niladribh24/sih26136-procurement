import uuid

import pytest
from sqlalchemy import select

from app.models import StartupProfile
from app.services.uploads import MAX_UPLOAD_BYTES
from tests.helpers import PDF_BYTES, auth, pdf_file, signup


def upload(client, token: str, **kwargs):
    return client.post("/api/startups/me/documents", files=pdf_file(**kwargs), headers=auth(token))


# ---------- GET / PATCH /api/startups/me ----------

def test_get_my_profile(client):
    s = signup(client)
    res = client.get("/api/startups/me", headers=auth(s["token"]))

    assert res.status_code == 200
    assert res.json() == {
        "userId": s["id"],
        "startupName": s["orgName"],
        "dpiitNumber": "DIPP12345",
        "dpiitVerified": False,
        "tags": [],
        "skills": [],
        "documents": [],
    }


def test_patch_my_profile(client):
    s = signup(client)
    body = {
        "startupName": "AeroKisan Technologies",
        "turnoverBand": "₹1Cr–₹5Cr",
        "location": "Bengaluru, Karnataka",
        "incorporationYear": 2022,
        "description": "Drone optics.",
    }
    res = client.patch("/api/startups/me", json=body, headers=auth(s["token"]))

    assert res.status_code == 200, res.text
    assert res.json().items() >= body.items()
    # startupName is the user's orgName, so the session reflects it too.
    assert client.get("/api/auth/me", headers=auth(s["token"])).json()["orgName"] == "AeroKisan Technologies"


def test_patch_leaves_unsent_fields_alone_and_null_clears(client):
    s = signup(client)
    client.patch("/api/startups/me", json={"location": "Pune", "description": "x"}, headers=auth(s["token"]))
    res = client.patch("/api/startups/me", json={"location": None}, headers=auth(s["token"]))

    data = res.json()
    assert "location" not in data
    assert data["description"] == "x"


def test_changing_dpiit_resets_verification(client, db):
    s = signup(client)
    profile = db.scalar(select(StartupProfile).where(StartupProfile.user_id == uuid.UUID(s["id"])))
    profile.dpiit_verified = True
    db.flush()

    res = client.patch("/api/startups/me", json={"dpiitNumber": "dpiit54321"}, headers=auth(s["token"]))

    assert res.json()["dpiitNumber"] == "DPIIT54321"
    assert res.json()["dpiitVerified"] is False


@pytest.mark.parametrize(
    "body",
    [
        {"startupName": None},
        {"startupName": "  "},
        {"dpiitNumber": "12345"},
        {"turnoverBand": "lots"},
        {"incorporationYear": 3000},
    ],
)
def test_patch_validation_errors(client, body):
    s = signup(client)
    assert client.patch("/api/startups/me", json=body, headers=auth(s["token"])).status_code == 422


@pytest.mark.parametrize("role", ["govt_officer", "evaluator"])
def test_my_profile_is_startup_only(client, role):
    other = signup(client, role)
    assert client.get("/api/startups/me", headers=auth(other["token"])).status_code == 403
    assert client.patch("/api/startups/me", json={}, headers=auth(other["token"])).status_code == 403


def test_my_profile_requires_token(client):
    assert client.get("/api/startups/me").status_code == 401


# ---------- documents ----------

def test_upload_document(client, upload_dir):
    s = signup(client)
    res = upload(client, s["token"], name="R&D_Dossier_2025.pdf")

    assert res.status_code == 201, res.text
    data = res.json()
    assert data["fileName"] == "R&D_Dossier_2025.pdf"
    # ML /extract isn't wired up yet.
    assert (data["domain"], data["tags"], data["summary"]) == ("", [], "")

    saved = list((upload_dir / "startup_docs").iterdir())
    assert len(saved) == 1 and saved[0].read_bytes() == PDF_BYTES
    assert "Dossier" not in saved[0].name  # stored under a random name, not the client's

    listed = client.get("/api/startups/me/documents", headers=auth(s["token"])).json()
    assert [d["id"] for d in listed] == [data["id"]]
    assert client.get("/api/startups/me", headers=auth(s["token"])).json()["documents"] == listed


def test_upload_filename_cannot_escape_upload_dir(client, upload_dir):
    s = signup(client)
    res = upload(client, s["token"], name="../../evil.pdf")
    assert res.status_code == 201
    assert res.json()["fileName"] == "evil.pdf"
    assert not (upload_dir.parent / "evil.pdf").exists()


def test_upload_rejects_non_pdf(client, upload_dir):
    s = signup(client)
    res = upload(client, s["token"], content=b"MZ\x90\x00 not a pdf", name="looks-fine.pdf")
    assert res.status_code == 415
    assert not any(upload_dir.rglob("*.pdf"))


def test_upload_rejects_over_10mb(client, upload_dir):
    s = signup(client)
    too_big = b"%PDF-" + b"0" * MAX_UPLOAD_BYTES
    res = upload(client, s["token"], content=too_big)
    assert res.status_code == 413
    assert not any(upload_dir.rglob("*.pdf"))


def test_upload_is_startup_only(client):
    officer = signup(client, "govt_officer")
    assert upload(client, officer["token"]).status_code == 403


# ---------- GET /api/startups/{userId} ----------

@pytest.mark.parametrize("role", ["govt_officer", "evaluator"])
def test_gov_can_view_startup_profile(client, role):
    s = signup(client)
    viewer = signup(client, role)
    res = client.get(f"/api/startups/{s['id']}", headers=auth(viewer["token"]))
    assert res.status_code == 200
    assert res.json()["startupName"] == s["orgName"]


def test_startup_can_view_itself_but_not_others(client):
    a, b = signup(client), signup(client)
    assert client.get(f"/api/startups/{a['id']}", headers=auth(a["token"])).status_code == 200
    assert client.get(f"/api/startups/{a['id']}", headers=auth(b["token"])).status_code == 403


def test_unknown_startup_404(client):
    officer = signup(client, "govt_officer")
    assert client.get(f"/api/startups/{uuid.uuid4()}", headers=auth(officer["token"])).status_code == 404
