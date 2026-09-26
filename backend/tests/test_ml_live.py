"""End-to-end check against the REAL ML service at ML_SERVICE_URL. Skipped unless asked for:

    $env:RUN_LIVE_ML = "1"; pytest tests/test_ml_live.py -q     (PowerShell)

Start the service first (see nlp/README.md). Rows are rolled back like every other test.
"""

import os
import uuid

import httpx
import pytest

from app.config import get_settings
from app.models import SolutionAbstract
from app.schemas.problem import Domain
from tests.helpers import auth, create_problem, pdf_file, signup, solution_form, text_pdf

pytestmark = pytest.mark.skipif(os.environ.get("RUN_LIVE_ML") != "1", reason="set RUN_LIVE_ML=1 to hit the real ML service")

DOSSIER = (
    "Our startup builds autonomous low-altitude UAVs for precision agriculture and border surveillance. "
    "The payload combines dual-band SWIR infrared optics with a Jetson Orin edge computer running "
    "thermal anomaly detection, delivering sub-5cm resolution maps and encrypted mesh telemetry. "
    "We completed field pilots over 1,200 hectares of irrigated farmland with the state agriculture department. "
)
PROPOSAL = (
    "We propose a canopy-penetrating multispectral UAV that detects concealed ground movement beneath dense "
    "foliage using SWIR imaging and on-board edge inference, with encrypted mesh telemetry that works without "
    "cellular coverage. The pilot runs for 8 weeks at a cost of 28.5 lakh rupees, reaching TRL-6 in field trials. "
)


@pytest.fixture
def ml():
    """Overrides the autouse FakeML from conftest.py: this module talks to the real service."""
    url = get_settings().ml_service_url
    try:
        httpx.get(f"{url}/healthz", timeout=3).raise_for_status()
    except httpx.HTTPError as e:
        pytest.fail(f"RUN_LIVE_ML=1 but the ML service at {url} isn't answering: {e}")


def test_real_ml_end_to_end(client, db, ml):
    s = signup(client)
    doc = client.post(
        "/api/startups/me/documents", files=pdf_file(content=text_pdf(DOSSIER * 2)), headers=auth(s["token"])
    ).json()
    assert doc["extractionStatus"] == "done", doc
    assert doc["domain"] in Domain.__args__
    assert doc["tags"] and doc["summary"]

    officer = signup(client, "govt_officer")
    problem = create_problem(client, officer["token"])
    sol = client.post(
        f"/api/problems/{problem['id']}/solutions",
        data=solution_form(),
        files=pdf_file(content=text_pdf(PROPOSAL * 2)),
        headers=auth(s["token"]),
    ).json()
    assert db.get(SolutionAbstract, uuid.UUID(sol["id"])).ai_summary

    (ranked,) = client.get(f"/api/problems/{problem['id']}/solutions", headers=auth(officer["token"])).json()
    assert 0 < ranked["matchScore"] <= 1
    assert ranked["matchExplanation"] and "pending" not in ranked["matchExplanation"]
    print("\nextract:", doc, "\nranked:", {k: ranked[k] for k in ("matchScore", "matchExplanation", "matchedKeywords")})
