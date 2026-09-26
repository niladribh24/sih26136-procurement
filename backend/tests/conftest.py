"""Shared fixtures. Tests run against the live sih_db (run `python init_db.py` first), but
every test is wrapped in a transaction that's rolled back afterwards, so no rows persist.
"""

import json
from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import engine, get_db
from app.main import app
from app.services import ml_client


@pytest.fixture
def db() -> Iterator[Session]:
    conn = engine.connect()
    outer = conn.begin()
    # create_savepoint: the endpoint's own commit()/rollback() only act on a SAVEPOINT
    # inside our outer transaction, which we always roll back at the end.
    session = Session(bind=conn, join_transaction_mode="create_savepoint", expire_on_commit=False)
    try:
        yield session
    finally:
        session.close()
        outer.rollback()
        conn.close()


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture(autouse=True)
def upload_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Uploads go to a per-test temp folder, never the real backend/uploads/."""
    monkeypatch.setattr(get_settings(), "upload_dir", tmp_path)
    return tmp_path


class FakeML:
    """Stands in for the nlp/ service behind httpx.MockTransport, so the real ml_client code
    (request building, timeouts aside, response validation) runs in every test.

    Starts "down" so no test can ever reach a real ML service by accident. Call up() or
    fail(status) to change that. Every request is recorded in .requests.
    """

    def __init__(self) -> None:
        self.mode: str | int = "down"
        self.requests: list[httpx.Request] = []
        self.extract_response: dict = dict(EXTRACT_RESPONSE)
        self.scores: dict[str, float] = {}  # candidate title -> match_score (default 0.5)

    def up(self) -> None:
        self.mode = "up"

    def fail(self, status_code: int = 500) -> None:
        self.mode = status_code

    def calls(self, path: str) -> list[httpx.Request]:
        return [r for r in self.requests if r.url.path == path]

    def handler(self, request: httpx.Request) -> httpx.Response:
        request.read()  # multipart bodies are streamed; load them so tests can inspect them
        self.requests.append(request)
        if self.mode == "down":
            raise httpx.ConnectError("ML service down (test)", request=request)
        if isinstance(self.mode, int):
            return httpx.Response(self.mode, json={"detail": "ML exploded (test)"})

        path = request.url.path
        if path == "/extract":
            return httpx.Response(200, json=self.extract_response)
        body = json.loads(request.content)
        if path == "/summarize":
            return httpx.Response(200, json={
                "solution_id": body["solution_id"],
                "summary": "Fake summary: " + body["text"][:60],
                "technical_claims": ["claim one"],
                "cost_timeline_summary": "8 weeks",
            })
        if path == "/rank":
            results = sorted(
                (
                    {
                        "solution_id": c["solution_id"],
                        "match_score": (score := self.scores.get(c["title"], 0.5)),
                        "match_percent": round(score * 100),
                        "match_explanation": f"Fake explanation for {c['title']}",
                        "matched_keywords": ["edge inference"],
                        "semantic_breakdown": {
                            "problem_relevance": score, "technical_feasibility": score, "operational_alignment": score,
                        },
                    }
                    for c in body["candidates"]
                ),
                key=lambda r: r["match_score"],
                reverse=True,
            )
            for i, r in enumerate(results, start=1):
                r["rank"] = i
            return httpx.Response(200, json={"problem_id": body["problem"]["id"], "results": results})
        return httpx.Response(404)


EXTRACT_RESPONSE = {
    "domain": "DroneTech",
    "confidence": 0.8,
    "tags": ["Computer Vision", "SWIR Sensors"],
    "skills": ["edge inference"],
    "summary": "Past work on autonomous UAV imaging.",
    "extracted_trl_estimate": "TRL-6",
    "ocr_performed": False,
}


@pytest.fixture(autouse=True)
def ml(monkeypatch: pytest.MonkeyPatch) -> FakeML:
    """Every test gets a fake ML service (down by default); pytest never needs the real one."""
    fake = FakeML()
    monkeypatch.setattr(
        ml_client,
        "_client",
        lambda: httpx.Client(base_url="http://ml.test", transport=httpx.MockTransport(fake.handler)),
    )
    return fake
