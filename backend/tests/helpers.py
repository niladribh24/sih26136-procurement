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


def text_pdf(text: str) -> bytes:
    """A minimal but valid one-page PDF whose text layer is `text` (so pypdf and the ML
    service's pdfplumber can both read it back). PDF_BYTES above has no text at all."""
    lines = [text[i:i + 90] for i in range(0, len(text), 90)]
    # Backslash and parentheses are special inside a PDF (string) literal.
    escaped = [ln.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)") for ln in lines]
    stream = ("BT /F1 9 Tf 12 TL 40 800 Td " + " ".join(f"({ln}) '" for ln in escaped) + " ET").encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offsets = bytearray(b"%PDF-1.4\n"), []
    for n, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % n + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % off for off in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return bytes(out)


def declare_turnover(client, startup_token: str, band: str = "₹1Cr–₹5Cr") -> None:
    """Without a turnover band the eligibility turnover rule fails (see eligibility.py)."""
    res = client.patch("/api/startups/me", json={"turnoverBand": band}, headers=auth(startup_token))
    assert res.status_code == 200, res.text


def pilot_body(solution_id: str, **overrides) -> dict:
    body = {
        "solutionId": solution_id,
        "independentValidatorName": "Prof. K. Rao (IIT Delhi)",
        "durationWeeks": 8,
        "totalBudget": 1_000_000,
        "milestones": [
            {"sequence": 1, "title": "Bench calibration", "description": "Lab sync", "targetKPI": "< 0.1% drops",
             "deliverableDueWeek": 2, "tranchePercentage": 30},
            {"sequence": 2, "title": "Field trials", "description": "Forest testbed", "targetKPI": "< 8% FP",
             "deliverableDueWeek": 5, "tranchePercentage": 70},
        ],
    }
    body.update(overrides)
    return body


def create_pilot(client, officer_token: str, solution_id: str, **overrides) -> dict:
    res = client.post("/api/pilots", json=pilot_body(solution_id, **overrides), headers=auth(officer_token))
    assert res.status_code == 201, res.text
    return res.json()


def pilot_setup(client) -> dict:
    """An officer's problem, a startup's (eligibility-pending, so allowed) solution to it, and
    an Approved pilot for that solution. Returns the tokens and objects."""
    officer = signup(client, "govt_officer")
    startup = signup(client, "startup")
    declare_turnover(client, startup["token"])
    problem = create_problem(client, officer["token"])
    solution = submit_solution(client, startup["token"], problem["id"])
    pilot = create_pilot(client, officer["token"], solution["id"])
    return {"officer": officer, "startup": startup, "problem": problem, "solution": solution, "pilot": pilot}


def set_pilot_status(client, token: str, pilot_id: str, status: str):
    return client.patch(f"/api/pilots/{pilot_id}/status", json={"status": status}, headers=auth(token))


def complete_pilot(client, s: dict) -> dict:
    """Start the pilot_setup() pilot and deliver + verify every milestone, so it's Completed.
    Returns the final Pilot response."""
    officer, startup, pid = s["officer"]["token"], s["startup"]["token"], s["pilot"]["id"]
    assert set_pilot_status(client, officer, pid, "Active").status_code == 200
    res = None
    for m in s["pilot"]["milestones"]:
        url = f"/api/pilots/{pid}/milestones/{m['id']}"
        deliver = {"achievedKPI": "met", "fileUrl": "/deliverables/x.pdf"}
        assert client.patch(f"{url}/deliverable", json=deliver, headers=auth(startup)).status_code == 200
        verify = {"verifiedBy": "Validator", "remarks": "ok", "status": "verified"}
        res = client.patch(f"{url}/verify", json=verify, headers=auth(officer))
        assert res.status_code == 200, res.text
    assert res.json()["status"] == "Completed"
    return res.json()


def procured_setup(client) -> dict:
    """pilot_setup() taken all the way to Procured (so it's a proven solution)."""
    s = pilot_setup(client)
    complete_pilot(client, s)
    token, pid = s["officer"]["token"], s["pilot"]["id"]
    assert set_pilot_status(client, token, pid, "Recommended for procurement").status_code == 200
    res = set_pilot_status(client, token, pid, "Procured")
    assert res.status_code == 200, res.text
    s["pilot"] = res.json()
    return s


def replication_body(pilot_id: str, **overrides) -> dict:
    body = {
        "pilotId": pilot_id,
        "requestingOfficerName": "Shri R. Annamalai",
        "requestingOfficerEmail": "ccf@example.gov.in",
        "targetDeploymentSite": "Coimbatore",
        "targetQuantity": 30,
        "targetBudget": 5_400_000,
        "deploymentTimelineWeeks": 12,
    }
    body.update(overrides)
    return body
