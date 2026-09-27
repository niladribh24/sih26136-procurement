"""Eligibility rule engine: the rules on their own, then submission, ML re-evaluation and the endpoints."""

import uuid
from types import SimpleNamespace

import pytest

from app.models import EligibilityCheck
from app.services import eligibility
from app.services.eligibility import EligibilityContext
from app.services.ml_sync import retry_pending
from tests.helpers import auth, create_problem, make_admin, pdf_file, signup, submit_solution


# ---------- the rules on their own (no DB) ----------

def ctx(
    dpiit="DIPP12345",
    turnover="₹1Cr–₹5Cr",
    domain="DroneTech",
    problem_domain="DroneTech",
    claimed=6,
    expected=6,
    has_documents=True,
    has_pending_documents=False,
) -> EligibilityContext:
    return EligibilityContext(
        solution=SimpleNamespace(claimed_trl=claimed),
        profile=SimpleNamespace(dpiit_number=dpiit, dpiit_verified=False, turnover_band=turnover, domain=domain),
        problem=SimpleNamespace(domain=problem_domain, trl_expected=expected),
        has_documents=has_documents,
        has_pending_documents=has_pending_documents,
    )


def statuses(c: EligibilityContext) -> dict[str, str]:
    return {r.key: res.status for r, res in eligibility.evaluate(c)}


def test_all_rules_pass():
    assert statuses(ctx()) == {"dpiit": "pass", "turnover": "pass", "domain": "pass", "trl": "pass"}


@pytest.mark.parametrize(
    "overrides, rule, status",
    [
        ({"dpiit": None}, "dpiit", "fail"),
        ({"dpiit": "ABC123"}, "dpiit", "fail"),
        ({"turnover": "> ₹25Cr"}, "turnover", "fail"),
        ({"turnover": None}, "turnover", "fail"),
        ({"turnover": "huge"}, "turnover", "fail"),
        ({"domain": "AgriTech"}, "domain", "fail"),
        ({"domain": "dronetech"}, "domain", "pass"),
        ({"domain": None, "has_pending_documents": True}, "domain", "pending"),
        ({"domain": None, "has_documents": False}, "domain", "pending"),
        ({"claimed": 5}, "trl", "fail"),
        ({"claimed": 8}, "trl", "pass"),
        ({"expected": None}, "trl", "pass"),
        ({"claimed": None}, "trl", "fail"),
    ],
)
def test_rule_outcomes(overrides, rule, status):
    assert statuses(ctx(**overrides))[rule] == status


def test_every_result_has_a_reason():
    for _, res in eligibility.evaluate(ctx(domain=None, turnover=None)):
        assert res.reason


@pytest.mark.parametrize(
    "rule_statuses, expected",
    [
        (["pass", "pass"], "eligible"),
        (["pass", "pending"], "pending"),
        (["fail", "pending"], "ineligible"),
    ],
)
def test_overall_status(rule_statuses, expected):
    assert eligibility.overall_status(rule_statuses) == expected


# ---------- end to end ----------

@pytest.fixture
def officer(client):
    return signup(client, "govt_officer")


@pytest.fixture
def problem(client, officer):
    return create_problem(client, officer["token"], domain="DroneTech", targetTRL="TRL-6")


def startup(client, turnover="₹1Cr–₹5Cr", upload=True) -> dict:
    s = signup(client)
    if turnover:
        res = client.patch("/api/startups/me", json={"turnoverBand": turnover}, headers=auth(s["token"]))
        assert res.status_code == 200, res.text
    if upload:
        res = client.post("/api/startups/me/documents", files=pdf_file(), headers=auth(s["token"]))
        assert res.status_code == 201, res.text
    return s


def get_eligibility(client, token, solution_id):
    return client.get(f"/api/solutions/{solution_id}/eligibility", headers=auth(token))


def rerun(client, token, solution_id):
    return client.post(f"/api/solutions/{solution_id}/eligibility", headers=auth(token))


def rules(body) -> dict[str, str]:
    return {r["rule"]: r["status"] for r in body["rules"]}


def row(db, solution_id) -> EligibilityCheck:
    check = eligibility.get_check(db, uuid.UUID(solution_id))
    db.refresh(check)
    return check


def test_submission_eligible(client, db, ml, officer, problem):
    ml.up()  # FakeML classifies every document as DroneTech
    s = startup(client)
    sol = submit_solution(client, s["token"], problem["id"], claimedTRL="TRL-7")

    res = get_eligibility(client, officer["token"], sol["id"])

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "eligible" and body["overallEligible"] is True
    assert rules(body) == {"dpiit": "pass", "turnover": "pass", "domain": "pass", "trl": "pass"}
    assert body["solutionId"] == sol["id"] and body["checkedAt"]
    assert all(r["reason"] and r["label"] for r in body["rules"])
    assert row(db, sol["id"]).overall_eligible is True


def test_submission_ineligible(client, db, ml, officer):
    ml.up()
    problem = create_problem(client, officer["token"], domain="AgriTech", targetTRL="TRL-7")
    s = startup(client, turnover="> ₹25Cr")
    sol = submit_solution(client, s["token"], problem["id"], claimedTRL="TRL-5")

    body = get_eligibility(client, officer["token"], sol["id"]).json()

    assert body["status"] == "ineligible" and body["overallEligible"] is False
    assert rules(body) == {"dpiit": "pass", "turnover": "fail", "domain": "fail", "trl": "fail"}
    reasons = {r["rule"]: r["reason"] for r in body["rules"]}
    assert "TRL-5" in reasons["trl"] and "TRL-7" in reasons["trl"]
    assert "AgriTech" in reasons["domain"]
    assert row(db, sol["id"]).overall_eligible is False


def test_undeclared_turnover_fails(client, ml, officer, problem):
    ml.up()
    s = startup(client, turnover=None)
    sol = submit_solution(client, s["token"], problem["id"])

    body = get_eligibility(client, officer["token"], sol["id"]).json()

    assert rules(body)["turnover"] == "fail" and body["status"] == "ineligible"


def test_fail_wins_over_pending(client, db, officer, problem):
    s = startup(client, turnover="> ₹25Cr")  # ML down: domain pending
    sol = submit_solution(client, s["token"], problem["id"])

    body = get_eligibility(client, officer["token"], sol["id"]).json()

    assert rules(body)["domain"] == "pending"
    assert body["status"] == "ineligible" and body["overallEligible"] is False


def test_pending_while_ml_down_then_retry_settles_it(client, db, ml, officer, problem):
    s = startup(client)  # ML down during upload: domain not classified
    sol = submit_solution(client, s["token"], problem["id"])

    body = get_eligibility(client, officer["token"], sol["id"]).json()
    assert rules(body)["domain"] == "pending"
    assert body["status"] == "pending" and body["overallEligible"] is None
    assert "being classified" in next(r["reason"] for r in body["rules"] if r["rule"] == "domain")
    assert row(db, sol["id"]).overall_eligible is None

    ml.up()
    retry_pending(db)

    body = get_eligibility(client, officer["token"], sol["id"]).json()
    assert body["status"] == "eligible" and rules(body)["domain"] == "pass"
    assert row(db, sol["id"]).overall_eligible is True


def test_pending_without_documents_settles_on_upload(client, ml, officer, problem):
    s = startup(client, upload=False)
    sol = submit_solution(client, s["token"], problem["id"])
    assert get_eligibility(client, officer["token"], sol["id"]).json()["status"] == "pending"

    ml.up()
    client.post("/api/startups/me/documents", files=pdf_file(), headers=auth(s["token"]))

    assert get_eligibility(client, officer["token"], sol["id"]).json()["status"] == "eligible"


def test_retry_counts_eligibility(client, db, officer, problem):
    # Checks already pending in the dev DB (e.g. seed.py run with ML down) are retried too.
    already_pending = len(eligibility.pending_or_unchecked(db))
    s = startup(client)
    submit_solution(client, s["token"], problem["id"])

    # ML still down: domain still pending
    assert retry_pending(db)["eligibility"] == (0, already_pending + 1)


def test_one_row_per_solution(client, db, ml, officer, problem):
    ml.up()
    s = startup(client)
    sol = submit_solution(client, s["token"], problem["id"])
    rerun(client, officer["token"], sol["id"])
    rerun(client, officer["token"], sol["id"])

    rows = db.query(EligibilityCheck).filter(EligibilityCheck.solution_id == uuid.UUID(sol["id"])).count()
    assert rows == 1


# ---------- endpoints ----------

def test_rerun_picks_up_profile_change(client, ml, officer, problem):
    ml.up()
    s = startup(client, turnover=None)
    sol = submit_solution(client, s["token"], problem["id"])
    assert get_eligibility(client, officer["token"], sol["id"]).json()["status"] == "ineligible"

    client.patch("/api/startups/me", json={"turnoverBand": "< ₹1Cr"}, headers=auth(s["token"]))
    res = rerun(client, officer["token"], sol["id"])

    assert res.status_code == 200, res.text
    assert res.json()["status"] == "eligible"


def test_rerun_role_rules(client, db, ml, officer, problem):
    s = startup(client)
    sol = submit_solution(client, s["token"], problem["id"])

    assert rerun(client, officer["token"], sol["id"]).status_code == 200
    assert rerun(client, signup(client, "evaluator")["token"], sol["id"]).status_code == 200
    assert rerun(client, signup(client, "govt_officer")["token"], sol["id"]).status_code == 403
    assert rerun(client, s["token"], sol["id"]).status_code == 403
    admin = make_admin(db)
    assert client.post(f"/api/solutions/{sol['id']}/eligibility", headers=admin).status_code == 403


def test_get_role_rules(client, db, officer, problem):
    s = startup(client)
    sol = submit_solution(client, s["token"], problem["id"])

    assert get_eligibility(client, signup(client, "evaluator")["token"], sol["id"]).status_code == 200
    assert get_eligibility(client, signup(client, "govt_officer")["token"], sol["id"]).status_code == 200
    assert client.get(f"/api/solutions/{sol['id']}/eligibility", headers=make_admin(db)).status_code == 200
    assert get_eligibility(client, s["token"], sol["id"]).status_code == 403
    assert get_eligibility(client, officer["token"], uuid.uuid4()).status_code == 404
    assert rerun(client, officer["token"], uuid.uuid4()).status_code == 404


def test_get_backfills_missing_check(client, db, officer, problem):
    s = startup(client)
    sol = submit_solution(client, s["token"], problem["id"])
    db.delete(eligibility.get_check(db, uuid.UUID(sol["id"])))
    db.flush()

    res = get_eligibility(client, officer["token"], sol["id"])

    assert res.status_code == 200 and len(res.json()["rules"]) == 4
    assert eligibility.get_check(db, uuid.UUID(sol["id"])) is not None
