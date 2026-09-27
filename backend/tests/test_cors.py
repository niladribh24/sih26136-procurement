"""CORS: the browser frontend (next dev on :3000) must be allowed to call the API, whether it's
opened as localhost or 127.0.0.1, and unknown origins must not be."""

import pytest
from fastapi.testclient import TestClient

from app.config import Settings


def _preflight(client: TestClient, origin: str):
    return client.options(
        "/api/problems",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )


@pytest.mark.parametrize("origin", ["http://localhost:3000", "http://127.0.0.1:3000"])
def test_frontend_origins_allowed(client: TestClient, origin: str) -> None:
    res = _preflight(client, origin)
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == origin


def test_unknown_origin_rejected(client: TestClient) -> None:
    res = _preflight(client, "http://evil.example")
    assert "access-control-allow-origin" not in res.headers


def test_cors_origins_parsing() -> None:
    s = Settings(database_url="x", jwt_secret="x", frontend_url=" http://localhost:3000/ , https://app.example ,")
    assert s.cors_origins == ["http://localhost:3000", "http://127.0.0.1:3000", "https://app.example"]
