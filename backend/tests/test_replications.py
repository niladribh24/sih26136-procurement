"""Replication requests: who can create them and move them pending -> approved -> in_pilot."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ProcurementRecord, ProvenSolution
from tests.helpers import auth, make_admin, pilot_setup, procured_setup, replication_body, signup


def _create(client, token_or_headers, pilot_id, **overrides):
    headers = token_or_headers if isinstance(token_or_headers, dict) else auth(token_or_headers)
    return client.post("/api/replications", json=replication_body(pilot_id, **overrides), headers=headers)


def _move(client, token, request_id, status):
    return client.patch(f"/api/replications/{request_id}/status", json={"status": status}, headers=auth(token))


def test_create_and_joined_fields(client, db: Session):
    s = procured_setup(client)
    other = signup(client, "govt_officer", orgName="Ministry of Housing & Urban Affairs")
    res = _create(client, other["token"], s["pilot"]["id"])
    assert res.status_code == 201, res.text
    r = res.json()
    assert r["status"] == "pending" and r["pilotId"] == s["pilot"]["id"]
    assert r["solutionTitle"] == s["solution"]["title"]
    assert r["startupName"] == s["startup"]["orgName"]
    assert r["originatingDepartment"] == s["problem"]["department"]
    assert r["requestingDepartment"] == "Ministry of Housing & Urban Affairs"
    assert (r["targetQuantity"], r["targetBudget"], r["deploymentTimelineWeeks"]) == (30, 5_400_000, 12)
    assert r["requestedAt"]
    # The counter on the proven solution follows the rows.
    proven = db.scalar(
        select(ProvenSolution)
        .join(ProcurementRecord, ProvenSolution.procurement_id == ProcurementRecord.id)
        .where(ProcurementRecord.pilot_id == uuid.UUID(s["pilot"]["id"]))
    )
    assert proven.replication_requests_count == 1

    listed = client.get("/api/replications", headers=auth(other["token"])).json()
    assert any(x["id"] == r["id"] for x in listed)


def test_create_roles(client, db: Session):
    s = procured_setup(client)
    pid = s["pilot"]["id"]
    assert _create(client, s["officer"]["token"], pid).status_code == 403  # own department
    assert _create(client, s["startup"]["token"], pid).status_code == 403
    assert _create(client, signup(client, "evaluator")["token"], pid).status_code == 403
    assert _create(client, make_admin(db), pid).status_code == 403
    assert client.post("/api/replications", json=replication_body(pid)).status_code == 401
    other = signup(client, "govt_officer")
    assert _create(client, other["token"], pid).status_code == 201
    # A second open request from the same officer is a duplicate.
    assert _create(client, other["token"], pid).status_code == 409
    # Bad body.
    assert _create(client, signup(client, "govt_officer")["token"], pid, targetQuantity=0).status_code == 422


def test_cannot_replicate_an_unprocured_pilot(client):
    s = pilot_setup(client)
    other = signup(client, "govt_officer")
    res = _create(client, other["token"], s["pilot"]["id"])
    assert res.status_code == 404
    assert _create(client, other["token"], str(uuid.uuid4())).status_code == 404


def test_status_flow_and_roles(client):
    s = procured_setup(client)
    requester = signup(client, "govt_officer")
    outsider = signup(client, "govt_officer")
    rid = _create(client, requester["token"], s["pilot"]["id"]).json()["id"]
    originator = s["officer"]["token"]

    # Illegal jumps: 400 whoever asks.
    assert _move(client, requester["token"], rid, "in_pilot").status_code == 400
    assert _move(client, originator, rid, "pending").status_code == 400

    # pending -> approved: only the originating officer.
    assert _move(client, requester["token"], rid, "approved").status_code == 403
    assert _move(client, outsider["token"], rid, "approved").status_code == 403
    assert _move(client, s["startup"]["token"], rid, "approved").status_code == 403
    res = _move(client, originator, rid, "approved")
    assert res.status_code == 200 and res.json()["status"] == "approved"

    # approved -> in_pilot: only the requesting officer.
    assert _move(client, originator, rid, "in_pilot").status_code == 403
    assert _move(client, outsider["token"], rid, "in_pilot").status_code == 403
    items = client.get("/api/proven-solutions", headers=auth(originator)).json()
    assert next(i for i in items if i["id"] == s["pilot"]["id"])["deployedUnits"] == 1
    res = _move(client, requester["token"], rid, "in_pilot")
    assert res.status_code == 200 and res.json()["status"] == "in_pilot"

    # in_pilot is final, and now counts as a deployment.
    assert _move(client, requester["token"], rid, "approved").status_code == 400
    items = client.get("/api/proven-solutions", headers=auth(originator)).json()
    assert next(i for i in items if i["id"] == s["pilot"]["id"])["deployedUnits"] == 2

    # Once it's no longer open, the same officer may ask again.
    assert _create(client, requester["token"], s["pilot"]["id"]).status_code == 201

    assert client.patch(
        f"/api/replications/{uuid.uuid4()}/status", json={"status": "approved"}, headers=auth(originator)
    ).status_code == 404


def test_startup_sees_only_requests_for_its_solutions(client):
    s = procured_setup(client)
    other = signup(client, "govt_officer")
    rid = _create(client, other["token"], s["pilot"]["id"]).json()["id"]
    own = client.get("/api/replications", headers=auth(s["startup"]["token"])).json()
    assert [r["id"] for r in own] == [rid]
    stranger = signup(client, "startup")
    assert client.get("/api/replications", headers=auth(stranger["token"])).json() == []
