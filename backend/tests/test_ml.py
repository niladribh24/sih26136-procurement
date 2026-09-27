"""ML integration, against the FakeML service from conftest.py (the real one is never needed)."""

import json
import uuid

import pytest
from sqlalchemy import select

from app.models import SolutionAbstract, StartupDocument, StartupProfile
from app.services.ml_sync import MIN_PDF_TEXT_CHARS, retry_pending
from app.services.solution_service import PENDING_EXPLANATION
from tests.conftest import EXTRACT_RESPONSE
from tests.helpers import auth, create_problem, pdf_file, signup, solution_form, submit_solution, text_pdf

PDF_TEXT = "Autonomous UAV with dual-band SWIR optics and on-board edge inference for canopy surveillance. " * 4


def upload(client, token, **kwargs):
    return client.post("/api/startups/me/documents", files=pdf_file(**kwargs), headers=auth(token))


def solution_row(db, solution_id: str) -> SolutionAbstract:
    return db.get(SolutionAbstract, uuid.UUID(solution_id))


@pytest.fixture
def officer(client):
    return signup(client, "govt_officer")


@pytest.fixture
def problem(client, officer):
    return create_problem(client, officer["token"])


# ---------- /extract on document upload ----------

def test_upload_returns_extraction_and_updates_profile(client, ml):
    ml.up()
    s = signup(client)
    res = upload(client, s["token"])

    assert res.status_code == 201
    data = res.json()
    assert data["extractionStatus"] == "done"
    assert data["domain"] == "DroneTech"
    assert data["tags"] == EXTRACT_RESPONSE["tags"]
    assert data["skills"] == EXTRACT_RESPONSE["skills"]
    assert data["summary"] == EXTRACT_RESPONSE["summary"]

    # The PDF itself goes to /extract, plus the six frontend domains to classify into.
    (req,) = ml.calls("/extract")
    assert b'name="file"' in req.content and b"%PDF-" in req.content
    assert b"AgriTech,GovTech,Defence,HealthTech,CleanTech,DroneTech" in req.content

    profile = client.get("/api/startups/me", headers=auth(s["token"])).json()
    assert profile["domain"] == "DroneTech"
    assert profile["tags"] == EXTRACT_RESPONSE["tags"]
    assert profile["skills"] == EXTRACT_RESPONSE["skills"]
    assert profile["documents"][0]["extractionStatus"] == "done"


def test_profile_merges_tags_across_documents(client, ml):
    ml.up()
    s = signup(client)
    upload(client, s["token"])
    ml.extract_response = {
        **EXTRACT_RESPONSE, "domain": "AgriTech", "confidence": 0.95,
        "tags": ["computer vision", "Crop Analytics"], "skills": ["GIS"],
    }
    upload(client, s["token"])

    profile = client.get("/api/startups/me", headers=auth(s["token"])).json()
    # Union with case-insensitive duplicates dropped. (Order isn't asserted: inside a test's
    # single transaction Postgres now() is frozen, so both uploads share an uploaded_at.)
    assert sorted(t.lower() for t in profile["tags"]) == ["computer vision", "crop analytics", "swir sensors"]
    assert sorted(profile["skills"]) == ["GIS", "edge inference"]
    assert profile["domain"] == "AgriTech"  # the more confident classification wins


@pytest.mark.parametrize("setup", ["down", "error", "bad_shape"])
def test_upload_succeeds_as_pending_when_ml_fails(client, ml, setup):
    if setup == "error":
        ml.fail(500)
    elif setup == "bad_shape":
        ml.up()
        ml.extract_response = {"domain": "DroneTech"}  # missing fields: must not be stored
    s = signup(client)
    res = upload(client, s["token"])

    assert res.status_code == 201
    data = res.json()
    assert data["extractionStatus"] == "pending"
    assert (data["domain"], data["tags"], data["skills"], data["summary"]) == ("", [], [], "")
    assert client.get("/api/startups/me", headers=auth(s["token"])).json()["tags"] == []


# ---------- /summarize on solution submission ----------

def test_submit_summarizes_pdf_text(client, db, ml, problem):
    ml.up()
    s = signup(client)
    res = client.post(
        f"/api/problems/{problem['id']}/solutions",
        data=solution_form(),
        files=pdf_file(content=text_pdf(PDF_TEXT)),
        headers=auth(s["token"]),
    )
    assert res.status_code == 201
    assert "aiSummary" not in res.json()  # stored only: Solution in types.ts has no such field

    (req,) = ml.calls("/summarize")
    body = json.loads(req.content)
    assert body["solution_id"] == res.json()["id"]
    assert "dual-band SWIR optics" in body["text"]  # the PDF's text, not the abstract
    assert solution_form()["abstract"] not in body["text"]

    row = solution_row(db, res.json()["id"])
    assert row.ai_summary.startswith("Fake summary: Autonomous UAV")
    assert row.summary_result["technical_claims"] == ["claim one"]


def test_submit_falls_back_to_abstract_when_pdf_has_little_text(client, db, ml, problem):
    ml.up()
    s = signup(client)
    sol = submit_solution(client, s["token"], problem["id"])  # PDF_BYTES: no text layer

    (req,) = ml.calls("/summarize")
    assert json.loads(req.content)["text"] == solution_form()["abstract"]
    assert solution_row(db, sol["id"]).ai_summary is not None


def test_short_pdf_text_counts_as_little_text(client, ml, problem):
    ml.up()
    s = signup(client)
    short = "Too short to use."
    assert len(short) < MIN_PDF_TEXT_CHARS
    client.post(
        f"/api/problems/{problem['id']}/solutions",
        data=solution_form(),
        files=pdf_file(content=text_pdf(short)),
        headers=auth(s["token"]),
    )
    (req,) = ml.calls("/summarize")
    assert json.loads(req.content)["text"] == solution_form()["abstract"]


def test_submit_succeeds_when_ml_down(client, db, problem):
    s = signup(client)
    sol = submit_solution(client, s["token"], problem["id"])
    row = solution_row(db, sol["id"])
    assert row.ai_summary is None and row.summary_result is None


# ---------- /rank on the officer/evaluator listing ----------

def list_solutions(client, token, problem_id):
    res = client.get(f"/api/problems/{problem_id}/solutions", headers=auth(token))
    assert res.status_code == 200, res.text
    return res.json()


def test_officer_listing_ranks_once(client, db, ml, officer, problem):
    a, b = signup(client), signup(client)
    sol_a = submit_solution(client, a["token"], problem["id"], title="Weak proposal")
    sol_b = submit_solution(client, b["token"], problem["id"], title="Strong proposal", claimedTRL="TRL-7")
    ml.up()
    ml.scores = {"Weak proposal": 0.41, "Strong proposal": 0.87}

    listed = list_solutions(client, officer["token"], problem["id"])

    (req,) = ml.calls("/rank")  # one call for the whole problem, not one per solution
    body = json.loads(req.content)
    assert body["problem"] == {
        "id": problem["id"], "title": problem["title"], "description": problem["description"],
        "desired_outcome": problem["desiredOutcome"], "domain": "DroneTech", "target_trl": "TRL-6",
    }
    assert {c["solution_id"]: c["claimed_trl"] for c in body["candidates"]} == {
        sol_a["id"]: "TRL-6", sol_b["id"]: "TRL-7",
    }

    assert [s["id"] for s in listed] == [sol_b["id"], sol_a["id"]]
    assert listed[0]["matchScore"] == 0.87
    assert listed[0]["matchExplanation"] == "Fake explanation for Strong proposal"
    assert listed[0]["matchedKeywords"] == ["edge inference"]
    row = solution_row(db, sol_b["id"])
    assert row.rank_result["rank"] == 1 and row.rank_result["semantic_breakdown"]["problem_relevance"] == 0.87

    # Everything is scored now, so listing again doesn't call ML.
    list_solutions(client, officer["token"], problem["id"])
    assert len(ml.calls("/rank")) == 1


def test_new_submission_triggers_rerank(client, ml, officer, problem):
    ml.up()
    submit_solution(client, signup(client)["token"], problem["id"])
    list_solutions(client, officer["token"], problem["id"])
    submit_solution(client, signup(client)["token"], problem["id"])
    list_solutions(client, officer["token"], problem["id"])

    rank_calls = ml.calls("/rank")
    assert len(rank_calls) == 2
    assert len(json.loads(rank_calls[1].content)["candidates"]) == 2


def test_listing_when_ml_down_returns_pending(client, officer, problem):
    submit_solution(client, signup(client)["token"], problem["id"])
    (sol,) = list_solutions(client, officer["token"], problem["id"])
    assert (sol["matchScore"], sol["matchExplanation"], sol["matchedKeywords"]) == (0, PENDING_EXPLANATION, [])


def test_startup_listing_never_ranks(client, ml, problem):
    ml.up()
    s = signup(client)
    submit_solution(client, s["token"], problem["id"])
    list_solutions(client, s["token"], problem["id"])
    assert ml.calls("/rank") == []


# ---------- POST /api/problems/{id}/solutions/rank ----------

def force_rank(client, token, problem_id):
    return client.post(f"/api/problems/{problem_id}/solutions/rank", headers=auth(token))


def test_force_rank_by_owner_and_evaluator(client, ml, officer, problem):
    submit_solution(client, signup(client)["token"], problem["id"])
    ml.up()
    for token in (officer["token"], signup(client, "evaluator")["token"]):
        res = force_rank(client, token, problem["id"])
        assert res.status_code == 200
        assert res.json()[0]["matchScore"] == 0.5
    assert len(ml.calls("/rank")) == 2  # re-ranks even when already scored


def test_force_rank_role_rules(client, ml, problem):
    submit_solution(client, signup(client)["token"], problem["id"])
    ml.up()
    assert force_rank(client, signup(client, "govt_officer")["token"], problem["id"]).status_code == 403
    assert force_rank(client, signup(client)["token"], problem["id"]).status_code == 403
    assert ml.calls("/rank") == []


def test_force_rank_when_ml_down_503(client, officer, problem):
    submit_solution(client, signup(client)["token"], problem["id"])
    assert force_rank(client, officer["token"], problem["id"]).status_code == 503


def test_force_rank_with_no_solutions(client, ml, officer, problem):
    ml.up()
    assert force_rank(client, officer["token"], problem["id"]).json() == []
    assert ml.calls("/rank") == []  # /rank rejects an empty candidate list


# ---------- retry_ml.py ----------

def test_retry_pending_fills_everything(client, db, ml, problem):
    s = signup(client)
    doc = upload(client, s["token"]).json()
    sol = submit_solution(client, s["token"], problem["id"])
    assert doc["extractionStatus"] == "pending"

    ml.up()
    counts = retry_pending(db)

    # extract already settles eligibility (see test_eligibility.py), so only the ML pipelines here.
    ml_counts = {k: v for k, v in counts.items() if k != "eligibility"}
    assert all(done == attempted and attempted >= 1 for done, attempted in ml_counts.values()), counts
    assert db.get(StartupDocument, uuid.UUID(doc["id"])).extract_result is not None
    row = solution_row(db, sol["id"])
    assert row.ai_summary is not None and row.rank_result is not None
    assert client.get("/api/startups/me", headers=auth(s["token"])).json()["tags"] == EXTRACT_RESPONSE["tags"]


def test_retry_pending_leaves_things_pending_when_ml_still_down(client, db, problem):
    s = signup(client)
    upload(client, s["token"])
    submit_solution(client, s["token"], problem["id"])

    counts = retry_pending(db)

    assert all(done == 0 for done, _ in counts.values()), counts
    # Only this startup's documents: the dev DB may hold others (e.g. seed.py demo data).
    own_docs = select(StartupDocument.extract_result).join(StartupProfile).where(
        StartupProfile.user_id == uuid.UUID(s["id"])
    )
    assert db.scalars(own_docs).all() == [None]


# ---------- summary input cleanup ----------

def test_without_title_strips_a_labelled_wrapped_title():
    from app.services.ml_sync import without_title

    title = "LoRaWAN soil moisture network with canal-rotation-aware advisories"
    text = (
        "Solution Proposal: LoRaWAN soil moisture network with canal-\nrotation-aware advisories\n"
        "Submitted by BhoomiSense.\n1. Summary. Probes report every 30 minutes."
    )
    assert without_title(text, title) == "Submitted by BhoomiSense. 1. Summary. Probes report every 30 minutes."


def test_without_title_strips_a_bare_title_or_heading_only():
    from app.services.ml_sync import without_title

    assert without_title("Crop Watch\nThe system maps stress.", "Crop Watch") == "The system maps stress."
    assert without_title("Solution Proposal\nThe system maps stress.", "Other") == "The system maps stress."
    # Nothing that looks like a heading: the text is only whitespace-normalised.
    body = "The system maps crop stress from\nSentinel-2 imagery."
    assert without_title(body, "Crop Watch") == "The system maps crop stress from Sentinel-2 imagery."


def test_submit_sends_pdf_text_without_its_title(client, ml, problem):
    ml.up()
    s = signup(client)
    form = solution_form(title="Canopy UAV")
    client.post(
        f"/api/problems/{problem['id']}/solutions",
        data=form,
        files=pdf_file(content=text_pdf("Solution Proposal: Canopy UAV " + PDF_TEXT)),
        headers=auth(s["token"]),
    )
    (req,) = ml.calls("/summarize")
    sent = json.loads(req.content)["text"]
    assert not sent.lower().startswith("solution proposal") and not sent.startswith("Canopy UAV")
    assert sent.startswith(PDF_TEXT.split()[0])
