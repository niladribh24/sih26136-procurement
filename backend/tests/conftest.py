"""Shared fixtures. Tests run against the live sih_db (run `python init_db.py` first), but
every test is wrapped in a transaction that's rolled back afterwards, so no rows persist.
"""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import engine, get_db
from app.main import app


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
