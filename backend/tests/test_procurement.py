"""Completed -> Recommended for procurement -> Procured, and the performance score."""

import uuid
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Pilot, PilotStatusHistory, ProcurementRecord, ProvenSolution, User
from app.services import pilot_service, procurement_service
from app.services.pilot_service import performance_score
from tests.helpers import auth, complete_pilot, make_admin, pilot_setup, procured_setup, set_pilot_status, signup


def _count(db: Session, model, **where) -> int:
    stmt = select(func.count()).select_from(model)
    for col, value in where.items():
        stmt = stmt.where(getattr(model, col) == value)
    return db.scalar(stmt)


def test_procurement_writes_records_in_one_step(client, db: Session):
    s = pilot_setup(client)
    complete_pilot(client, s)
    token, pid = s["officer"]["token"], s["pilot"]["id"]
    pilot_uuid = uuid.UUID(pid)

    res = set_pilot_status(client, token, pid, "Recommended for procurement").json()
    assert res["status"] == "Recommended for procurement"
    assert "sanctionDocketId" not in res and _count(db, ProcurementRecord, pilot_id=pilot_uuid) == 0

    res = set_pilot_status(client, token, pid, "Procured").json()
    assert res["status"] == "Procured"
    record = db.scalar(select(ProcurementRecord).where(ProcurementRecord.pilot_id == pilot_uuid))
    assert record.status == "issued" and record.procured_at is not None
    assert record.compliance_checklist["all_milestones_verified"] is True
    assert record.compliance_checklist["performance_score"] == res["performanceScore"]
    assert _count(db, ProvenSolution, procurement_id=record.id) == 1
    assert res["sanctionDocketId"] == str(record.id)
    assert res["sanctionOrderRef"] == f"SAN/{datetime.now().year}/{res['code']}"
    history = db.scalars(
        select(PilotStatusHistory.to_status).where(PilotStatusHistory.pilot_id == pilot_uuid)
    ).all()
    assert "recommended_for_procurement" in history and "procured" in history

    # Procured is final.
    assert set_pilot_status(client, token, pid, "Completed").status_code == 400


def test_can_only_recommend_a_completed_pilot(client):
    s = pilot_setup(client)
    token, pid = s["officer"]["token"], s["pilot"]["id"]
    assert set_pilot_status(client, token, pid, "Active").status_code == 200
    assert set_pilot_status(client, token, pid, "Recommended for procurement").status_code == 400
    assert set_pilot_status(client, token, pid, "Procured").status_code == 400


def test_procurement_roles(client, db: Session):
    s = pilot_setup(client)
    complete_pilot(client, s)
    pid = s["pilot"]["id"]
    for headers in (
        auth(s["startup"]["token"]),
        auth(signup(client, "evaluator")["token"]),
        auth(signup(client, "govt_officer")["token"]),
        make_admin(db),
    ):
        res = client.patch(f"/api/pilots/{pid}/status", json={"status": "Recommended for procurement"}, headers=headers)
        assert res.status_code == 403


def test_failure_while_procuring_saves_nothing(client, db: Session, monkeypatch):
    s = pilot_setup(client)
    complete_pilot(client, s)
    token, pid = s["officer"]["token"], s["pilot"]["id"]
    set_pilot_status(client, token, pid, "Recommended for procurement")

    def boom(*args, **kwargs):
        raise RuntimeError("disk full")

    monkeypatch.setattr(procurement_service, "record_procurement", boom)
    officer = db.get(User, uuid.UUID(s["officer"]["id"]))
    pilot = pilot_service.get_pilot(db, officer, pid)
    with pytest.raises(RuntimeError):
        pilot_service.update_status(db, officer, pilot, "Procured")
    db.rollback()

    pilot = db.get(Pilot, uuid.UUID(pid))
    db.refresh(pilot)
    assert pilot.status == "recommended_for_procurement"
    assert _count(db, ProcurementRecord, pilot_id=pilot.id) == 0
    assert _count(db, PilotStatusHistory, pilot_id=pilot.id, to_status="procured") == 0


def test_procured_pilot_is_a_proven_solution(client):
    s = procured_setup(client)
    items = client.get("/api/proven-solutions", headers=auth(s["startup"]["token"])).json()
    item = next(i for i in items if i["id"] == s["pilot"]["id"])
    assert item["pilotCode"] == s["pilot"]["code"]
    assert item["title"] == s["solution"]["title"]
    assert item["domain"] == s["problem"]["domain"]
    assert item["originatingDepartment"] == s["problem"]["department"]
    assert item["startupName"] == s["startup"]["orgName"]
    assert item["performanceScore"] == s["pilot"]["performanceScore"]
    assert item["deployedUnits"] == 1
    assert item["budgetPerUnit"] == "₹10,00,000" and item["totalBudget"] == 1_000_000
    assert item["validationDate"] and item["gfrExemptionClause"]


# ---------- performance score ----------

def _m(status: str, due: date | None = None, verified_on: date | None = None):
    at = datetime(verified_on.year, verified_on.month, verified_on.day, 6, tzinfo=timezone.utc) if verified_on else None
    return SimpleNamespace(status=status, due_date=due, verified_at=at)


D = date(2026, 10, 1)


def test_score_needs_a_verified_milestone():
    assert performance_score(90, [_m("pending", D), _m("submitted", D)], 0) is None


def test_score_perfect_and_rubric_weight():
    ms = [_m("verified", D, D), _m("verified", D, D - timedelta(days=3))]
    assert performance_score(100, ms, 0) == 100.0
    assert performance_score(87, ms, 0) == 94.8  # 34.8 + 40 + 20


def test_score_failed_and_late_count_against():
    ms = [_m("verified", D, D), _m("verified", D, D + timedelta(days=2))]  # one late
    # R 0.8, Q 2/(2+2) = 0.5, T 0.5 -> 32 + 20 + 10
    assert performance_score(80, ms, failed_count=2) == 62.0


def test_score_without_rubric_reweights():
    ms = [_m("verified", D, D), _m("verified", D, D + timedelta(days=1))]
    # Q 1, T 0.5 -> (2 x 1 + 0.5) / 3
    assert performance_score(None, ms, 0) == 83.3


def test_score_on_pilot_response(client):
    s = pilot_setup(client)
    assert "performanceScore" not in s["pilot"]
    final = complete_pilot(client, s)
    assert final["performanceScore"] == 100.0  # no rubric, nothing failed, all on time
