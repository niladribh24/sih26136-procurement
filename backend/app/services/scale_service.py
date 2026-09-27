"""Scale & replication (Module 10): the proven-solutions directory and replication requests.

A proven solution is a procured pilot (procurement_service writes the row). Replication
requests stay normalized: the titles and department names in the response are joined at
read time (proven_solution -> procurement_record -> pilot -> problem / solution / startup),
never copied onto the row.

Replication status is its own small state machine:

    pending --(originating officer approves)--> approved --(requesting officer deploys)--> in_pilot
"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased, selectinload

from app.models import (
    Pilot,
    ProcurementRecord,
    Problem,
    ProvenSolution,
    ReplicationRequest,
    SolutionAbstract,
    StartupProfile,
    User,
)
from app.schemas.common import to_date_str
from app.schemas.scale import ReplicationCreate, ReplicationRequestOut, ScaleSolutionOut
from app.services import pilot_service

GFR_CLAUSE = "GFR 2017 Rule 194 (startup innovation procurement)"

# (from, to) -> who may make the move: "originator" = the officer who posted the pilot's
# problem, "requester" = the officer who filed the request.
REPLICATION_TRANSITIONS: dict[tuple[str, str], str] = {
    ("pending", "approved"): "originator",
    ("approved", "in_pilot"): "requester",
}


def inr(amount: float) -> str:
    """Indian digit grouping: 3800000 -> '₹38,00,000'."""
    digits = str(int(round(amount)))
    head, tail = digits[:-3], digits[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return "₹" + ",".join([*groups, tail])


# ---------- proven solutions ----------

def list_proven(db: Session, user: User) -> list[ScaleSolutionOut]:
    """Every proven solution, most recently procured first. A public directory: any
    logged-in user sees all of them."""
    rows = db.execute(
        select(ProvenSolution, ProcurementRecord)
        .join(ProcurementRecord, ProvenSolution.procurement_id == ProcurementRecord.id)
        .order_by(ProcurementRecord.procured_at.desc())
    ).all()
    if not rows:
        return []
    pilot_ids = [record.pilot_id for _, record in rows]
    pilots = {
        p.id: p
        for p in db.scalars(
            pilot_service.base_query().options(selectinload(Pilot.solution)).where(Pilot.id.in_(pilot_ids))
        ).unique()
    }
    perf = pilot_service.scores(db, list(pilots.values()))
    # Replications that reached in_pilot, per proven solution — one grouped query.
    deployed = dict(db.execute(
        select(ReplicationRequest.proven_solution_id, func.count())
        .where(ReplicationRequest.status == "in_pilot")
        .group_by(ReplicationRequest.proven_solution_id)
    ).all())

    out = []
    for proven, record in rows:
        p = pilots[record.pilot_id]
        solution = p.solution
        out.append(ScaleSolutionOut(
            id=str(p.id),
            pilot_code=p.code,
            title=(solution.title if solution else None) or p.problem.title,
            domain=p.problem.domain,
            startup_name=p.startup.user.org_name,
            dpiit_number=p.startup.dpiit_number or "",
            originating_department=p.problem.department or "",
            validation_date=to_date_str(record.procured_at),
            performance_score=perf[p.id] or 0.0,
            deployed_units=1 + deployed.get(proven.id, 0),
            budget_per_unit=inr(float(p.budget_cap or 0)),
            total_budget=float(p.budget_cap) if p.budget_cap is not None else None,
            summary=(solution.ai_summary or solution.abstract_text or "") if solution else "",
            gfr_exemption_clause=GFR_CLAUSE,
        ))
    return out


# ---------- replication requests ----------

def _replication_query():
    requester = aliased(User)
    startup_user = aliased(User)
    return (
        select(
            ReplicationRequest,
            Pilot.id,
            SolutionAbstract.title,
            startup_user.org_name,
            Problem.department,
            requester.org_name,
        )
        .join(ProvenSolution, ReplicationRequest.proven_solution_id == ProvenSolution.id)
        .join(ProcurementRecord, ProvenSolution.procurement_id == ProcurementRecord.id)
        .join(Pilot, ProcurementRecord.pilot_id == Pilot.id)
        .join(Problem, Pilot.problem_id == Problem.id)
        .outerjoin(SolutionAbstract, Pilot.solution_id == SolutionAbstract.id)
        .join(StartupProfile, Pilot.startup_id == StartupProfile.id)
        .join(startup_user, StartupProfile.user_id == startup_user.id)
        .outerjoin(requester, ReplicationRequest.requesting_dept_id == requester.id)
    )


def _replication_out(row) -> ReplicationRequestOut:
    r, pilot_id, title, startup_name, originating, requesting = row
    return ReplicationRequestOut(
        id=str(r.id),
        pilot_id=str(pilot_id),
        solution_title=title or "",
        startup_name=startup_name,
        originating_department=originating or "",
        requesting_department=requesting or "",
        requesting_officer_name=r.requesting_officer_name or "",
        requesting_officer_email=r.requesting_officer_email or "",
        target_deployment_site=r.target_deployment_site or "",
        target_quantity=r.target_quantity or 0,
        target_budget=float(r.target_budget) if r.target_budget is not None else None,
        deployment_timeline_weeks=r.deployment_timeline_weeks,
        requested_at=to_date_str(r.requested_at),
        status=r.status,
    )


def list_replications(db: Session, user: User) -> list[ReplicationRequestOut]:
    stmt = _replication_query().order_by(ReplicationRequest.requested_at.desc())
    if user.role == "startup":
        # A startup only sees requests to replicate its own solutions.
        stmt = stmt.where(StartupProfile.user_id == user.id)
    return [_replication_out(row) for row in db.execute(stmt)]


def replication_out(db: Session, request_id: uuid.UUID) -> ReplicationRequestOut:
    return _replication_out(db.execute(_replication_query().where(ReplicationRequest.id == request_id)).one())


def _proven_for(db: Session, pilot: Pilot) -> ProvenSolution:
    proven = db.scalar(
        select(ProvenSolution)
        .join(ProcurementRecord, ProvenSolution.procurement_id == ProcurementRecord.id)
        .where(ProcurementRecord.pilot_id == pilot.id)
    )
    if proven is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No proven solution for this pilot (it isn't procured)")
    return proven


def create_replication(db: Session, officer: User, req: ReplicationCreate) -> uuid.UUID:
    pilot = pilot_service.get_pilot(db, officer, req.pilot_id)
    proven = _proven_for(db, pilot)
    if pilot.problem.posted_by == officer.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="This is your own department's pilot; replication requests come from other departments",
        )
    open_request = db.scalar(
        select(ReplicationRequest.id).where(
            ReplicationRequest.proven_solution_id == proven.id,
            ReplicationRequest.requesting_dept_id == officer.id,
            ReplicationRequest.status.in_(("pending", "approved")),
        )
    )
    if open_request is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="You already have an open replication request for this solution"
        )
    request = ReplicationRequest(
        proven_solution_id=proven.id,
        pilot_id=pilot.id,
        requesting_dept_id=officer.id,
        requesting_officer_name=req.requesting_officer_name,
        requesting_officer_email=req.requesting_officer_email,
        target_deployment_site=req.target_deployment_site,
        target_quantity=req.target_quantity,
        target_budget=req.target_budget,
        deployment_timeline_weeks=req.deployment_timeline_weeks,
    )
    db.add(request)
    # Counter kept in step with the rows, in the same transaction.
    proven.replication_requests_count = (proven.replication_requests_count or 0) + 1
    db.commit()
    return request.id


def update_replication_status(db: Session, officer: User, request_id: uuid.UUID, target: str) -> None:
    request = db.get(ReplicationRequest, request_id)
    if request is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Replication request not found")
    who = REPLICATION_TRANSITIONS.get((request.status, target))
    if who is None:
        allowed = [t for (f, t) in REPLICATION_TRANSITIONS if f == request.status]
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f'Cannot move a replication request from "{request.status}" to "{target}". '
                   f"Allowed next: {', '.join(allowed) or 'none (final status)'}.",
        )
    if who == "originator":
        posted_by = db.scalar(
            select(Problem.posted_by)
            .join(Pilot, Pilot.problem_id == Problem.id)
            .where(Pilot.id == request.pilot_id)
        )
        if posted_by != officer.id:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, detail="Only the officer who ran the original pilot can approve this request"
            )
    elif request.requesting_dept_id != officer.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Only the officer who made this request can mark it in pilot"
        )
    request.status = target
    db.commit()
