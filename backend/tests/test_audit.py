"""POST /api/pilots/:id/audit (api.ts logAuditEntry)."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditEntry
from tests.helpers import auth, make_admin, pilot_setup, signup

ENTRY = {"action": "Sanction docket printed", "actorName": "Dr. A. Mehra", "actorRole": "Sanctioning officer", "hash": "ab12"}


def test_gov_roles_can_log(client, db: Session):
    s = pilot_setup(client)
    pid = s["pilot"]["id"]
    evaluator = signup(client, "evaluator")
    for headers in (auth(s["officer"]["token"]), auth(evaluator["token"]), make_admin(db)):
        assert client.post(f"/api/pilots/{pid}/audit", json=ENTRY, headers=headers).status_code == 204

    rows = db.scalars(select(AuditEntry).where(AuditEntry.pilot_id == uuid.UUID(pid))).all()
    assert len(rows) == 3
    assert {r.action for r in rows} == {ENTRY["action"]} and all(r.hash == "ab12" for r in rows)
    assert str(evaluator["id"]) in {str(r.recorded_by) for r in rows}


def test_defaults_to_the_callers_name(client, db: Session):
    s = pilot_setup(client)
    res = client.post(f"/api/pilots/{s['pilot']['id']}/audit", json={"action": "Viewed"}, headers=auth(s["officer"]["token"]))
    assert res.status_code == 204
    row = db.scalar(select(AuditEntry).where(AuditEntry.pilot_id == uuid.UUID(s["pilot"]["id"])))
    assert (row.actor_name, row.actor_role) == (s["officer"]["name"], "govt_officer")


def test_audit_roles_and_errors(client):
    s = pilot_setup(client)
    pid = s["pilot"]["id"]
    assert client.post(f"/api/pilots/{pid}/audit", json=ENTRY, headers=auth(s["startup"]["token"])).status_code == 403
    assert client.post(f"/api/pilots/{pid}/audit", json=ENTRY).status_code == 401
    token = s["officer"]["token"]
    assert client.post(f"/api/pilots/{pid}/audit", json={"action": ""}, headers=auth(token)).status_code == 422
    assert client.post("/api/pilots/PLT-1900-999/audit", json=ENTRY, headers=auth(token)).status_code == 404
