"""The pilot state machine: every legal move works and is recorded; every other one is a 400."""

import itertools
import uuid
from datetime import timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Pilot, PilotMilestone, PilotStatusHistory, User
from app.services import pilot_state_machine as sm
from tests.helpers import auth, pilot_setup, set_pilot_status

ALL = list(sm.LABELS)
LEGAL = {(a, b) for a, targets in sm.TRANSITIONS.items() for b in targets}


def test_transition_table_is_exactly_the_documented_one():
    assert LEGAL == {
        ("proposed", "under_review"),
        ("under_review", "approved"),
        ("approved", "active"),
        ("active", "completed"),
        ("active", "failed"),
        ("completed", "recommended_for_procurement"),
        ("recommended_for_procurement", "procured"),
    }
    assert set(sm.TRANSITIONS) == set(ALL)  # every status has an entry, even the final ones
    assert set(sm.FROM_LABEL.values()) == set(ALL)


@pytest.fixture
def pilot_and_user(client, db: Session):
    s = pilot_setup(client)
    pilot = db.get(Pilot, uuid.UUID(s["pilot"]["id"]))
    user = db.get(User, uuid.UUID(s["officer"]["id"]))
    return pilot, user


@pytest.mark.parametrize("current,target", list(itertools.product(ALL, ALL)))
def test_every_pair(db: Session, pilot_and_user, current: str, target: str):
    pilot, user = pilot_and_user
    for m in pilot.milestones:  # so "completed" isn't blocked by the milestone rule
        m.status = "verified"
    pilot.status = current
    db.flush()
    before = db.scalars(select(PilotStatusHistory).where(PilotStatusHistory.pilot_id == pilot.id)).all()

    if (current, target) in LEGAL:
        sm.transition(db, pilot, target, user)
        db.flush()
        assert pilot.status == target
        history = db.scalars(
            select(PilotStatusHistory).where(PilotStatusHistory.pilot_id == pilot.id)
            .order_by(PilotStatusHistory.changed_at.desc(), PilotStatusHistory.id)
        ).all()
        assert len(history) == len(before) + 1
        new = next(h for h in history if h not in before)
        assert (new.from_status, new.to_status, new.changed_by) == (current, target, user.id)
        assert new.changed_at is not None
    else:
        with pytest.raises(HTTPException) as exc:
            sm.transition(db, pilot, target, user)
        assert exc.value.status_code == 400
        assert sm.LABELS[current] in exc.value.detail and "Allowed next" in exc.value.detail
        assert pilot.status == current


def test_completed_requires_every_milestone_verified(db: Session, pilot_and_user):
    pilot, user = pilot_and_user
    pilot.status = "active"
    with pytest.raises(HTTPException) as exc:
        sm.transition(db, pilot, "completed", user)
    assert exc.value.status_code == 400 and "not verified" in exc.value.detail


def test_creation_history_and_api_walkthrough(client, db: Session):
    s = pilot_setup(client)
    pilot_id, token = s["pilot"]["id"], s["officer"]["token"]
    assert s["pilot"]["status"] == "Approved"

    rows = db.scalars(
        select(PilotStatusHistory).where(PilotStatusHistory.pilot_id == uuid.UUID(pilot_id))
    ).all()
    assert sorted((r.from_status or "", r.to_status) for r in rows) == sorted(
        [("", "proposed"), ("proposed", "under_review"), ("under_review", "approved")]
    )
    assert all(str(r.changed_by) == s["officer"]["id"] for r in rows)

    # Illegal jump over the API: a 400 that names the allowed moves.
    res = set_pilot_status(client, token, pilot_id, "Procured")
    assert res.status_code == 400
    assert res.json()["detail"] == 'Cannot move pilot from "Approved" to "Procured". Allowed next: Active.'

    res = set_pilot_status(client, token, pilot_id, "Active")
    assert res.status_code == 200 and res.json()["status"] == "Active"
    # Completing early is refused while milestones are unverified.
    assert set_pilot_status(client, token, pilot_id, "Completed").status_code == 400
    res = set_pilot_status(client, token, pilot_id, "Failed")
    assert res.status_code == 200 and res.json()["status"] == "Failed"
    # Failed is final.
    assert set_pilot_status(client, token, pilot_id, "Active").status_code == 400


def test_unknown_status_label_is_422(client):
    s = pilot_setup(client)
    res = client.patch(
        f"/api/pilots/{s['pilot']['id']}/status", json={"status": "active"}, headers=auth(s["officer"]["token"])
    )
    assert res.status_code == 422


def test_starting_the_pilot_keeps_milestone_weeks(client, db: Session):
    s = pilot_setup(client)
    pilot = db.get(Pilot, uuid.UUID(s["pilot"]["id"]))
    # Pretend it was approved 10 days ago; starting it today moves every date forward.

    pilot.start_date -= timedelta(days=10)
    pilot.end_date -= timedelta(days=10)
    for m in db.scalars(select(PilotMilestone).where(PilotMilestone.pilot_id == pilot.id)):
        m.due_date -= timedelta(days=10)
    db.flush()
    res = set_pilot_status(client, s["officer"]["token"], s["pilot"]["id"], "Active").json()
    assert res["startDate"] == s["pilot"]["startDate"]
    assert res["durationWeeks"] == 8
    assert [m["deliverableDueWeek"] for m in res["milestones"]] == [2, 5]
