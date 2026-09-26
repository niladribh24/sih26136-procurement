import uuid

import pytest
from sqlalchemy import select

from app.models import Evaluation, StartupProfile
from app.services.solution_service import PENDING_EXPLANATION
from app.services.uploads import MAX_UPLOAD_BYTES
from tests.helpers import (
    PDF_BYTES,
    auth,
    create_problem,
    make_admin,
    pdf_file,
    signup,
    solution_form,
    submit_solution,
)

# Every required field of frontend/lib/types.ts Solution (rubricScore is optional).
SOLUTION_KEYS = {
    "id", "problemId", "startupId", "startupName", "dpiitNumber", "dpiitVerified", "location", "title",
    "abstract", "claimedTRL", "proposedCost", "proposedDurationWeeks", "submittedAt", "matchScore",
    "matchExplanation", "matchedKeywords", "pdfUrl", "status",
}


@pytest.fixture
def officer(client):
    return signup(client, "govt_officer")


@pytest.fixture
def problem(client, officer):
    return create_problem(client, officer["token"])


def post_solution(client, token, problem_id, files=None, **form):
    return client.post(
        f"/api/problems/{problem_id}/solutions",
        data=solution_form(**form),
        files=files or pdf_file(),
        headers=auth(token),
    )


# ---------- submit ----------

def test_startup_submits_solution(client, problem, upload_dir):
    s = signup(client)
    client.patch("/api/startups/me", json={"location": "Bengaluru, Karnataka"}, headers=auth(s["token"]))

    res = post_solution(client, s["token"], problem["id"])

    assert res.status_code == 201, res.text
    data = res.json()
    assert set(data) == SOLUTION_KEYS
    assert data["problemId"] == problem["id"]
    assert data["startupId"] == s["id"]  # user id, which the frontend compares to session.id
    assert data["startupName"] == s["orgName"]
    assert data["dpiitNumber"] == "DIPP12345"
    assert data["dpiitVerified"] is False
    assert data["location"] == "Bengaluru, Karnataka"
    assert data["claimedTRL"] == "TRL-6"
    assert data["proposedCost"] == 2850000
    assert data["proposedDurationWeeks"] == 8
    assert data["status"] == "submitted"
    # Not ranked yet: ranking happens when an officer/evaluator lists the solutions.
    assert (data["matchScore"], data["matchExplanation"], data["matchedKeywords"]) == (0, PENDING_EXPLANATION, [])
    assert data["pdfUrl"] == f"/api/solutions/{data['id']}/pdf"
    assert len(list((upload_dir / "solutions").iterdir())) == 1


def test_client_cannot_claim_dpiit_verified(client, problem):
    s = signup(client)
    res = post_solution(client, s["token"], problem["id"], dpiitVerified="true", startupName="Someone Else")
    assert res.json()["dpiitVerified"] is False
    assert res.json()["startupName"] == s["orgName"]


def test_duplicate_submission_409(client, problem, upload_dir):
    s = signup(client)
    assert post_solution(client, s["token"], problem["id"]).status_code == 201
    assert post_solution(client, s["token"], problem["id"]).status_code == 409
    assert len(list((upload_dir / "solutions").iterdir())) == 1


@pytest.mark.parametrize("role", ["govt_officer", "evaluator"])
def test_only_startups_submit(client, problem, role):
    other = signup(client, role)
    assert post_solution(client, other["token"], problem["id"]).status_code == 403


def test_submit_rejects_non_pdf(client, problem, upload_dir):
    s = signup(client)
    res = post_solution(client, s["token"], problem["id"], files=pdf_file(content=b"hello", name="a.pdf"))
    assert res.status_code == 415
    assert not any(upload_dir.rglob("*.pdf"))


def test_submit_rejects_over_10mb(client, problem, upload_dir):
    s = signup(client)
    big = pdf_file(content=b"%PDF-" + b"0" * MAX_UPLOAD_BYTES)
    assert post_solution(client, s["token"], problem["id"], files=big).status_code == 413
    assert not any(upload_dir.rglob("*.pdf"))


def test_submit_requires_file(client, problem):
    s = signup(client)
    res = client.post(f"/api/problems/{problem['id']}/solutions", data=solution_form(), headers=auth(s["token"]))
    assert res.status_code == 422


@pytest.mark.parametrize(
    "overrides",
    [{"proposedCost": "0"}, {"proposedDurationWeeks": "-1"}, {"claimedTRL": "TRL-1"}, {"title": " "}],
)
def test_submit_validation_errors(client, problem, overrides):
    s = signup(client)
    assert post_solution(client, s["token"], problem["id"], **overrides).status_code == 422


def test_submit_to_unknown_problem_404(client):
    s = signup(client)
    assert post_solution(client, s["token"], str(uuid.uuid4())).status_code == 404


# ---------- read & visibility ----------

def test_startup_sees_only_own_solutions(client, problem):
    a, b = signup(client), signup(client)
    sol_a = submit_solution(client, a["token"], problem["id"])
    sol_b = submit_solution(client, b["token"], problem["id"])

    # Every read path hides b's proposal from a.
    assert [s["id"] for s in client.get("/api/solutions", headers=auth(a["token"])).json()] == [sol_a["id"]]
    ranked = client.get(f"/api/problems/{problem['id']}/solutions", headers=auth(a["token"])).json()
    assert [s["id"] for s in ranked] == [sol_a["id"]]
    by_b = client.get(f"/api/solutions?startupId={b['id']}", headers=auth(a["token"])).json()
    assert by_b == []
    assert client.get(f"/api/solutions/{sol_b['id']}", headers=auth(a["token"])).status_code == 404
    assert client.get(f"/api/solutions/{sol_b['id']}/pdf", headers=auth(a["token"])).status_code == 404

    assert client.get(f"/api/solutions/{sol_a['id']}", headers=auth(a["token"])).json() == sol_a


@pytest.mark.parametrize("role", ["govt_officer", "evaluator"])
def test_gov_roles_see_all_solutions(client, problem, role):
    a, b = signup(client), signup(client)
    ids = {submit_solution(client, s["token"], problem["id"])["id"] for s in (a, b)}
    viewer = signup(client, role)

    listed = client.get(f"/api/problems/{problem['id']}/solutions", headers=auth(viewer["token"])).json()
    assert {s["id"] for s in listed} == ids
    filtered = client.get(
        f"/api/solutions?problemId={problem['id']}&startupId={a['id']}", headers=auth(viewer["token"])
    ).json()
    assert [s["startupId"] for s in filtered] == [a["id"]]


def test_admin_sees_all_solutions(client, db, problem):
    sol = submit_solution(client, signup(client)["token"], problem["id"])
    res = client.get(f"/api/solutions/{sol['id']}", headers=make_admin(db))
    assert res.status_code == 200


def test_read_requires_token(client):
    assert client.get("/api/solutions").status_code == 401


def test_rubric_score_included_once_evaluated(client, db, problem):
    sol = submit_solution(client, signup(client)["token"], problem["id"])
    evaluator = signup(client, "evaluator")
    db.add(Evaluation(
        solution_id=uuid.UUID(sol["id"]), evaluator_id=uuid.UUID(evaluator["id"]),
        technical_merit=25, cost_realism=15, team_capability=18, timeline_viability=22,
    ))
    db.flush()

    res = client.get(f"/api/solutions/{sol['id']}", headers=auth(evaluator["token"]))
    assert res.json()["rubricScore"] == {
        "technicalMerit": 25, "costRealism": 15, "teamCapability": 18, "timelineViability": 22, "total": 80,
    }


# ---------- PDF download ----------

def test_pdf_download(client, officer, problem):
    s = signup(client)
    sol = submit_solution(client, s["token"], problem["id"])

    for token in (s["token"], officer["token"]):
        res = client.get(sol["pdfUrl"], headers=auth(token))
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert res.content == PDF_BYTES


# ---------- status ----------

def status_patch(client, token_or_headers, sol_id, new_status="shortlisted"):
    headers = token_or_headers if isinstance(token_or_headers, dict) else auth(token_or_headers)
    return client.patch(f"/api/solutions/{sol_id}/status", json={"status": new_status}, headers=headers)


def test_owning_officer_changes_status(client, officer, problem):
    sol = submit_solution(client, signup(client)["token"], problem["id"])
    res = status_patch(client, officer["token"], sol["id"])
    assert res.status_code == 200
    assert res.json() == {**sol, "status": "shortlisted"}


def test_any_evaluator_changes_status(client, problem):
    sol = submit_solution(client, signup(client)["token"], problem["id"])
    evaluator = signup(client, "evaluator")
    assert status_patch(client, evaluator["token"], sol["id"], "rejected").json()["status"] == "rejected"


def test_other_officer_cannot_change_status(client, problem):
    sol = submit_solution(client, signup(client)["token"], problem["id"])
    other = signup(client, "govt_officer")
    assert status_patch(client, other["token"], sol["id"]).status_code == 403


def test_startup_and_admin_cannot_change_status(client, db, problem):
    s = signup(client)
    sol = submit_solution(client, s["token"], problem["id"])
    assert status_patch(client, s["token"], sol["id"]).status_code == 403
    assert status_patch(client, make_admin(db), sol["id"]).status_code == 403


def test_invalid_status_422(client, officer, problem):
    sol = submit_solution(client, signup(client)["token"], problem["id"])
    assert status_patch(client, officer["token"], sol["id"], "approved").status_code == 422


def test_startup_location_comes_from_profile(client, db, problem):
    # Location lives on startup_profiles, so a later profile edit shows on existing solutions.
    s = signup(client)
    sol = submit_solution(client, s["token"], problem["id"])
    profile = db.scalar(select(StartupProfile).where(StartupProfile.user_id == uuid.UUID(s["id"])))
    profile.location = "Hyderabad, Telangana"
    db.flush()
    assert client.get(f"/api/solutions/{sol['id']}", headers=auth(s["token"])).json()["location"] == (
        "Hyderabad, Telangana"
    )
