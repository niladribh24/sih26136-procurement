import re
import uuid
from datetime import date, datetime, timedelta

import pytest

from app.schemas.common import IST
from tests.helpers import auth, create_problem, problem_body, signup, submit_solution

# Every field of frontend/lib/types.ts Problem — the response must have exactly these.
PROBLEM_KEYS = {
    "id", "code", "title", "department", "ministry", "domain", "description", "desiredOutcome",
    "budgetBand", "targetTRL", "deadline", "createdAt", "submissionCount", "status",
}


# ---------- create ----------

def test_officer_creates_problem(client):
    officer = signup(client, "govt_officer")
    body = problem_body()
    res = client.post("/api/problems", json=body, headers=auth(officer["token"]))

    assert res.status_code == 201, res.text
    data = res.json()
    assert set(data) == PROBLEM_KEYS
    assert re.fullmatch(r"PRB-\d{4}-\d{3,}", data["code"])
    assert data["status"] == "open"
    assert data["submissionCount"] == 0
    assert data["createdAt"] == datetime.now(IST).date().isoformat()
    assert {k: data[k] for k in body} == body


def test_problem_codes_are_unique(client):
    officer = signup(client, "govt_officer")
    codes = {create_problem(client, officer["token"])["code"] for _ in range(3)}
    assert len(codes) == 3


@pytest.mark.parametrize("role", ["startup", "evaluator"])
def test_only_officers_create_problems(client, role):
    other = signup(client, role)
    assert client.post("/api/problems", json=problem_body(), headers=auth(other["token"])).status_code == 403


def test_create_requires_token(client):
    assert client.post("/api/problems", json=problem_body()).status_code == 401


@pytest.mark.parametrize(
    "overrides",
    [
        {"title": " "},
        {"domain": "SpaceTech"},
        {"targetTRL": "TRL-2"},
        {"budgetBand": "lots"},
        {"deadline": (date.today() - timedelta(days=1)).isoformat()},
    ],
)
def test_create_validation_errors(client, overrides):
    officer = signup(client, "govt_officer")
    res = client.post("/api/problems", json=problem_body(**overrides), headers=auth(officer["token"]))
    assert res.status_code == 422


# ---------- read ----------

@pytest.mark.parametrize("role", ["startup", "govt_officer", "evaluator"])
def test_everyone_logged_in_can_read(client, role):
    officer = signup(client, "govt_officer")
    created = create_problem(client, officer["token"])
    reader = signup(client, role)

    listed = client.get("/api/problems", headers=auth(reader["token"])).json()
    assert created["id"] in {p["id"] for p in listed}
    res = client.get(f"/api/problems/{created['id']}", headers=auth(reader["token"]))
    assert res.status_code == 200 and res.json() == created


def test_read_requires_token(client):
    assert client.get("/api/problems").status_code == 401


def test_get_by_code(client):
    officer = signup(client, "govt_officer")
    created = create_problem(client, officer["token"])
    res = client.get(f"/api/problems/{created['code'].lower()}", headers=auth(officer["token"]))
    assert res.json()["id"] == created["id"]


def test_unknown_problem_404(client):
    officer = signup(client, "govt_officer")
    for key in (str(uuid.uuid4()), "PRB-1999-000"):
        assert client.get(f"/api/problems/{key}", headers=auth(officer["token"])).status_code == 404


def test_list_filters(client):
    a, b = signup(client, "govt_officer"), signup(client, "govt_officer")
    agri = create_problem(client, a["token"], domain="AgriTech")
    drone = create_problem(client, b["token"], domain="DroneTech")

    mine = client.get("/api/problems?mine=true", headers=auth(a["token"])).json()
    assert [p["id"] for p in mine] == [agri["id"]]

    agri_ids = {p["id"] for p in client.get("/api/problems?domain=AgriTech", headers=auth(a["token"])).json()}
    assert agri["id"] in agri_ids and drone["id"] not in agri_ids


def test_submission_count(client):
    officer = signup(client, "govt_officer")
    problem = create_problem(client, officer["token"])
    for _ in range(2):
        submit_solution(client, signup(client)["token"], problem["id"])

    res = client.get(f"/api/problems/{problem['id']}", headers=auth(officer["token"]))
    assert res.json()["submissionCount"] == 2
    listed = client.get("/api/problems?mine=true", headers=auth(officer["token"])).json()
    assert listed[0]["submissionCount"] == 2


# ---------- edit ----------

def test_officer_edits_own_problem(client):
    officer = signup(client, "govt_officer")
    problem = create_problem(client, officer["token"])
    changes = {"title": "Revised title", "targetTRL": "TRL-7", "status": "evaluating"}

    res = client.patch(f"/api/problems/{problem['id']}", json=changes, headers=auth(officer["token"]))

    assert res.status_code == 200, res.text
    assert res.json() == {**problem, **changes}


def test_officer_cannot_edit_others_problem(client):
    owner, other = signup(client, "govt_officer"), signup(client, "govt_officer")
    problem = create_problem(client, owner["token"])
    res = client.patch(f"/api/problems/{problem['id']}", json={"title": "Hijacked"}, headers=auth(other["token"]))
    assert res.status_code == 403


@pytest.mark.parametrize("role", ["startup", "evaluator"])
def test_non_officers_cannot_edit(client, role):
    owner = signup(client, "govt_officer")
    problem = create_problem(client, owner["token"])
    other = signup(client, role)
    res = client.patch(f"/api/problems/{problem['id']}", json={"title": "x"}, headers=auth(other["token"]))
    assert res.status_code == 403


@pytest.mark.parametrize("body", [{"title": None}, {"status": "closed"}])
def test_edit_validation_errors(client, body):
    officer = signup(client, "govt_officer")
    problem = create_problem(client, officer["token"])
    res = client.patch(f"/api/problems/{problem['id']}", json=body, headers=auth(officer["token"]))
    assert res.status_code == 422
