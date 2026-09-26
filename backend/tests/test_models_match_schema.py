"""Guards against drift between backend/schema.sql (applied to the live DB) and app/models.

Requires the database to exist with the schema applied: run `python init_db.py` first.
"""

import pytest
from sqlalchemy import inspect, insert
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError

from app.database import engine
from app.models import Base, ReplicationRequest

DIALECT = postgresql.dialect()
MODEL_TABLES = Base.metadata.tables


def type_name(sa_type) -> str:
    return sa_type.compile(dialect=DIALECT)


@pytest.fixture(scope="module")
def inspector():
    return inspect(engine)


def test_same_tables(inspector):
    assert set(inspector.get_table_names()) == set(MODEL_TABLES)


@pytest.mark.parametrize("table_name", sorted(MODEL_TABLES))
def test_columns_match(inspector, table_name):
    db_cols = {c["name"]: c for c in inspector.get_columns(table_name)}
    model_cols = MODEL_TABLES[table_name].columns

    assert set(db_cols) == {c.name for c in model_cols}, "column names differ"
    for col in model_cols:
        db_col = db_cols[col.name]
        assert type_name(col.type) == type_name(db_col["type"]), f"{table_name}.{col.name} type"
        assert col.nullable == db_col["nullable"], f"{table_name}.{col.name} nullability"
        assert (col.server_default is not None or col.computed is not None) == (
            db_col.get("default") is not None or db_col.get("computed") is not None
        ), f"{table_name}.{col.name} default"


@pytest.mark.parametrize("table_name", sorted(MODEL_TABLES))
def test_foreign_keys_match(inspector, table_name):
    db_fks = {
        (fk["constrained_columns"][0], fk["referred_table"], (fk.get("options") or {}).get("ondelete"))
        for fk in inspector.get_foreign_keys(table_name)
    }
    model_fks = {
        (fk.parent.name, fk.column.table.name, fk.ondelete) for fk in MODEL_TABLES[table_name].foreign_keys
    }
    assert db_fks == model_fks


@pytest.mark.parametrize("bad_status", ["rejected", None])
def test_replication_status_rejects_invalid(bad_status):
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            with pytest.raises(IntegrityError):
                conn.execute(insert(ReplicationRequest.__table__).values(status=bad_status))
        finally:
            trans.rollback()


def test_replication_status_accepts_valid():
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            for status in ("pending", "approved", "in_pilot"):
                conn.execute(insert(ReplicationRequest.__table__).values(status=status))
        finally:
            trans.rollback()
