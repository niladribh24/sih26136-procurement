"""Pilot creation, visibility, role rules and the milestone flow."""

import pytest

from tests.helpers import (
    auth,
    create_problem,
    declare_turnover,
    make_admin,
    pilot_body,
    pilot_setup,
    set_pilot_status,
    signup,
    submit_solution,
)

RUBRIC = {"technicalMerit": 25, "costRealism": 15, "teamCapability": 15, "timelineViability": 25}


def _deliver(client, token, pilot_id, milestone_id, kpi="0.05% drops"):
    return client.patch(
        f"/api/pilots/{pilot_id}/milestones/{milestone_id}/deliverable",
        json={"achievedKPI": kpi, "fileUrl": "/deliverables/report.pdf"},
        headers=auth(token),
    )


def _verify(client, headers, pilot_id, milestone_id, status="verified"):
    return client.patch(
        f"/api/pilots/{pilot_id}/milestones/{milestone_id}/verify",
        json={"verifiedBy": "Prof. K. Rao", "remarks": "Checked", "status": status,
              "verificationReportUrl": "/reports/r.pdf"},
        headers=headers if isinstance(headers, dict) else auth(headers),
    )


@pytest.fixture
def active(client):
    s = pilot_setup(client)
    assert set_pilot_status(client, s["officer"]["token"], s["pilot"]["id"], "Active").status_code == 200
    return s


# ---------- creation ----------

def test_create_pilot_shape_and_side_effects(client):
    s = pilot_setup(client)
    p, sol, prob = s["pilot"], s["solution"], s["problem"]
    assert p["code"].startswith("PLT-") and p["status"] == "Approved"
    assert (p["problemId"], p["solutionId"], p["startupId"]) == (prob["id"], sol["id"], s["startup"]["id"])
    assert p["startupName"] == s["startup"]["orgName"] and p["dpiitNumber"] == "DIPP12345"
    assert p["department"] == prob["department"] and p["ministry"] == prob["ministry"]
    assert p["leadOfficerName"] == s["officer"]["name"]
    assert p["independentValidatorName"] == "Prof. K. Rao (IIT Delhi)"
    assert p["durationWeeks"] == 8 and p["totalBudget"] == 1_000_000
    assert "completionDate" not in p
    ms = p["milestones"]
    assert [(m["sequence"], m["deliverableDueWeek"], m["tranchePercentage"], m["trancheAmount"]) for m in ms] == [
        (1, 2, 30, 300_000), (2, 5, 70, 700_000)
    ]
    assert all(m["status"] == "pending" and m["trancheDisbursed"] is False for m in ms)
    assert ms[0]["targetKPI"] == "< 0.1% drops" and "achievedKPI" not in ms[0]

    token = s["officer"]["token"]
    assert client.get(f"/api/solutions/{sol['id']}", headers=auth(token)).json()["status"] == "shortlisted"
    assert client.get(f"/api/problems/{prob['id']}", headers=auth(token)).json()["status"] == "pilot_active"
    # Lookup by code works too, like problems.
    assert client.get(f"/api/pilots/{p['code']}", headers=auth(token)).json()["id"] == p["id"]


def test_duplicate_pilot_is_409(client):
    s = pilot_setup(client)
    res = client.post("/api/pilots", json=pilot_body(s["solution"]["id"]), headers=auth(s["officer"]["token"]))
    assert res.status_code == 409


def test_ineligible_solution_is_blocked(client):
    officer = signup(client, "govt_officer")
    startup = signup(client, "startup")
    declare_turnover(client, startup["token"])
    problem = create_problem(client, officer["token"])  # TRL-6 required
    solution = submit_solution(client, startup["token"], problem["id"], claimedTRL="TRL-5")

    res = client.post("/api/pilots", json=pilot_body(solution["id"]), headers=auth(officer["token"]))
    assert res.status_code == 409
    assert "ineligible" in res.json()["detail"] and "TRL-5" in res.json()["detail"]
    # Plain shortlisting is blocked the same way; other status changes aren't.
    url = f"/api/solutions/{solution['id']}/status"
    assert client.patch(url, json={"status": "shortlisted"}, headers=auth(officer["token"])).status_code == 409
    assert client.patch(url, json={"status": "rejected"}, headers=auth(officer["token"])).status_code == 200


@pytest.mark.parametrize("change", [
    {"milestones": []},
    {"durationWeeks": 4},  # milestone 2 is due in week 5
    {"totalBudget": 0},
    {"independentValidatorName": ""},
])
def test_invalid_pilot_body_is_422(client, change):
    officer = signup(client, "govt_officer")
    startup = signup(client, "startup")
    problem = create_problem(client, officer["token"])
    solution = submit_solution(client, startup["token"], problem["id"])
    res = client.post("/api/pilots", json=pilot_body(solution["id"], **change), headers=auth(officer["token"]))
    assert res.status_code == 422


def test_tranches_must_sum_to_100(client):
    officer = signup(client, "govt_officer")
    startup = signup(client, "startup")
    problem = create_problem(client, officer["token"])
    solution = submit_solution(client, startup["token"], problem["id"])
    body = pilot_body(solution["id"])
    body["milestones"][1]["tranchePercentage"] = 60
    res = client.post("/api/pilots", json=body, headers=auth(officer["token"]))
    assert res.status_code == 422 and "add up to 100" in res.text


def test_create_pilot_roles(client, db):
    officer = signup(client, "govt_officer")
    startup = signup(client, "startup")
    problem = create_problem(client, officer["token"])
    solution = submit_solution(client, startup["token"], problem["id"])
    body = pilot_body(solution["id"])
    assert client.post("/api/pilots", json=body).status_code == 401
    for headers in (auth(startup["token"]), auth(signup(client, "evaluator")["token"]), make_admin(db)):
        assert client.post("/api/pilots", json=body, headers=headers).status_code == 403
    other = signup(client, "govt_officer")
    assert client.post("/api/pilots", json=body, headers=auth(other["token"])).status_code == 403
    assert client.post("/api/pilots", json=pilot_body("not-a-uuid"), headers=auth(officer["token"])).status_code == 404


# ---------- visibility & status roles ----------

def test_visibility(client, db):
    s = pilot_setup(client)
    pid = s["pilot"]["id"]
    other_startup = signup(client, "startup")
    assert client.get(f"/api/pilots/{pid}", headers=auth(other_startup["token"])).status_code == 404
    assert client.get("/api/pilots", headers=auth(other_startup["token"])).json() == []
    assert [p["id"] for p in client.get("/api/pilots", headers=auth(s["startup"]["token"])).json()] == [pid]
    for headers in (auth(signup(client, "evaluator")["token"]), make_admin(db), auth(signup(client, "govt_officer")["token"])):
        assert client.get(f"/api/pilots/{pid}", headers=headers).status_code == 200
    assert client.get("/api/pilots/PLT-1900-999", headers=auth(s["officer"]["token"])).status_code == 404


def test_status_change_roles(client, db):
    s = pilot_setup(client)
    pid = s["pilot"]["id"]
    assert set_pilot_status(client, s["startup"]["token"], pid, "Active").status_code == 403
    assert set_pilot_status(client, signup(client, "evaluator")["token"], pid, "Active").status_code == 403
    assert set_pilot_status(client, signup(client, "govt_officer")["token"], pid, "Active").status_code == 403
    res = client.patch(f"/api/pilots/{pid}/status", json={"status": "Active"}, headers=make_admin(db))
    assert res.status_code == 403


# ---------- milestones ----------

def test_deliverable_needs_an_active_pilot(client):
    s = pilot_setup(client)  # still Approved
    m = s["pilot"]["milestones"][0]["id"]
    res = _deliver(client, s["startup"]["token"], s["pilot"]["id"], m)
    assert res.status_code == 400 and "Active" in res.json()["detail"]


def test_full_milestone_flow(client, active):
    s = active
    pid, officer, startup = s["pilot"]["id"], s["officer"]["token"], s["startup"]["token"]
    m1, m2 = (m["id"] for m in s["pilot"]["milestones"])

    # Only a submitted milestone can be verified.
    assert _verify(client, officer, pid, m1).status_code == 400

    res = _deliver(client, startup, pid, m1)
    assert res.status_code == 200
    got = res.json()["milestones"][0]
    assert (got["status"], got["achievedKPI"], got["deliverableFileUrl"]) == (
        "submitted", "0.05% drops", "/deliverables/report.pdf"
    )

    # Fail it: failed count goes up, no money moves.
    res = _verify(client, officer, pid, m1, "failed").json()
    assert res["milestones"][0]["status"] == "failed" and res["milestones"][0]["trancheDisbursed"] is False
    assert res["milestones"][0]["verifiedBy"] == "Prof. K. Rao"

    # Resubmit clears the old verification stamp; verifying releases the tranche.
    res = _deliver(client, startup, pid, m1).json()
    assert "verifiedBy" not in res["milestones"][0]
    res = _verify(client, officer, pid, m1).json()
    got = res["milestones"][0]
    assert got["status"] == "verified" and got["trancheDisbursed"] is True and got["disbursedAt"]
    assert got["verifiedAt"].endswith("IST") and got["verificationReportUrl"] == "/reports/r.pdf"
    assert res["status"] == "Active"

    # A verified milestone is final.
    assert _deliver(client, startup, pid, m1).status_code == 400
    assert _verify(client, officer, pid, m1).status_code == 400

    # Disburse is idempotent on a verified milestone, refused on an unverified one.
    assert client.patch(f"/api/pilots/{pid}/milestones/{m1}/disburse", headers=auth(officer)).status_code == 200
    assert client.patch(f"/api/pilots/{pid}/milestones/{m2}/disburse", headers=auth(officer)).status_code == 400

    # Last milestone verified -> the pilot completes by itself.
    _deliver(client, startup, pid, m2)
    res = _verify(client, officer, pid, m2).json()
    assert res["status"] == "Completed" and res["completionDate"]

    res = set_pilot_status(client, officer, pid, "Recommended for procurement")
    assert res.status_code == 200
    assert set_pilot_status(client, officer, pid, "Procured").json()["status"] == "Procured"


def test_failed_milestones_count(client, db, active):
    from uuid import UUID

    from app.models import Pilot

    s = active
    pid, m1 = s["pilot"]["id"], s["pilot"]["milestones"][0]["id"]
    for _ in range(2):
        _deliver(client, s["startup"]["token"], pid, m1)
        _verify(client, s["officer"]["token"], pid, m1, "failed")
    assert db.get(Pilot, UUID(pid)).failed_milestones_count == 2


def test_milestone_roles(client, db, active):
    s = active
    pid, m1 = s["pilot"]["id"], s["pilot"]["milestones"][0]["id"]
    # Deliverables: only the pilot's own startup (another startup can't even see the pilot).
    assert _deliver(client, s["officer"]["token"], pid, m1).status_code == 403
    assert _deliver(client, signup(client, "startup")["token"], pid, m1).status_code == 404
    assert _deliver(client, s["startup"]["token"], pid, "00000000-0000-0000-0000-000000000000").status_code == 404
    assert _deliver(client, s["startup"]["token"], pid, m1).status_code == 200

    # Verification: the owning officer or any evaluator; not the startup, another officer or admin.
    assert _verify(client, s["startup"]["token"], pid, m1).status_code == 403
    assert _verify(client, signup(client, "govt_officer")["token"], pid, m1).status_code == 403
    assert _verify(client, make_admin(db), pid, m1).status_code == 403
    assert _verify(client, signup(client, "evaluator")["token"], pid, m1).status_code == 200

    # Disbursal: owning officer only.
    url = f"/api/pilots/{pid}/milestones/{m1}/disburse"
    assert client.patch(url, headers=auth(signup(client, "evaluator")["token"])).status_code == 403
    assert client.patch(url, headers=auth(s["startup"]["token"])).status_code == 403
    assert client.patch(url, headers=auth(s["officer"]["token"])).status_code == 200


def test_conflict_of_interest(client, active):
    s = active
    pid, sol = s["pilot"]["id"], s["solution"]["id"]
    m1 = s["pilot"]["milestones"][0]["id"]
    evaluator = signup(client, "evaluator")
    res = client.post(f"/api/solutions/{sol}/rubric", json=RUBRIC, headers=auth(evaluator["token"]))
    assert res.status_code == 200
    _deliver(client, s["startup"]["token"], pid, m1)

    res = _verify(client, evaluator["token"], pid, m1)
    assert res.status_code == 403 and "Conflict of interest" in res.json()["detail"]
    # The owning officer didn't score it, so they can.
    assert _verify(client, s["officer"]["token"], pid, m1).status_code == 200
