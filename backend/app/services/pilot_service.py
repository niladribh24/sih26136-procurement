"""Pilots and their milestones (Module 5). Status changes go through pilot_state_machine."""

import uuid
from collections.abc import Sequence
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException, status
from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, contains_eager, selectinload

from app.models import Evaluation, Pilot, PilotMilestone, Problem, SolutionAbstract, StartupProfile, User
from app.schemas.common import IST, to_date_str
from app.schemas.pilot import DeliverableSubmit, MilestoneOut, MilestoneVerify, PilotCreate, PilotOut
from app.services import eligibility, pilot_state_machine
from app.services.pilot_state_machine import LABELS


def _not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, detail="Pilot not found")


def _today() -> date:
    return datetime.now(IST).date()


def _base_query() -> Select:
    # One query for the pilots with their problem, startup profile and the startup's user row;
    # milestones come in one extra SELECT ... WHERE pilot_id IN (...) for the whole list
    # (selectinload). Lazy loading them per pilot would be the N+1 problem.
    return (
        select(Pilot)
        .join(Pilot.problem)
        .join(Pilot.startup)
        .join(StartupProfile.user)
        .options(
            contains_eager(Pilot.problem),
            contains_eager(Pilot.startup).contains_eager(StartupProfile.user),
            selectinload(Pilot.milestones),
        )
    )


def _visible_to(stmt: Select, user: User) -> Select:
    # A startup only sees its own pilots (someone else's is a 404, like solutions).
    if user.role == "startup":
        stmt = stmt.where(StartupProfile.user_id == user.id)
    return stmt


def _week(start: date | None, day: date | None) -> int:
    if start is None or day is None:
        return 0
    return max((day - start).days // 7, 0)


def _stamp(value: datetime | None) -> str | None:
    return value.astimezone(IST).strftime("%Y-%m-%d %H:%M IST") if value else None


def _milestone_out(m: PilotMilestone, start: date | None) -> MilestoneOut:
    return MilestoneOut(
        id=str(m.id),
        pilot_id=str(m.pilot_id),
        sequence=m.sequence or 0,
        title=m.title,
        description=m.description or "",
        target_kpi=m.target_kpi or "",
        achieved_kpi=m.achieved_kpi,
        deliverable_due_week=_week(start, m.due_date),
        deliverable_file_url=m.evidence_url,
        tranche_amount=float(m.tranche_amount or 0),
        tranche_percentage=float(m.tranche_percentage or 0),
        status=m.status,
        tranche_disbursed=bool(m.tranche_disbursed),
        disbursed_at=to_date_str(m.disbursed_at) or None,
        verified_by=m.verified_by_name,
        verified_at=_stamp(m.verified_at),
        verification_remarks=m.verification_remarks,
        verification_report_url=m.verification_report_url,
    )


def to_out(db: Session, pilots: Sequence[Pilot]) -> list[PilotOut]:
    # Lead officer names and completion dates: one query each for the whole list.
    poster_ids = {p.problem.posted_by for p in pilots}
    officers = dict(db.execute(select(User.id, User.name).where(User.id.in_(poster_ids))).all()) if pilots else {}
    completed = pilot_state_machine.completion_dates(db, [p.id for p in pilots])
    out = []
    for p in pilots:
        profile, problem = p.startup, p.problem
        out.append(PilotOut(
            id=str(p.id),
            code=p.code,
            problem_id=str(p.problem_id),
            solution_id=str(p.solution_id) if p.solution_id else "",
            startup_id=str(profile.user_id),
            startup_name=profile.user.org_name,
            dpiit_number=profile.dpiit_number or "",
            dpiit_verified=bool(profile.dpiit_verified),
            department=problem.department or "",
            ministry=problem.ministry or "",
            lead_officer_name=officers.get(problem.posted_by, ""),
            independent_validator_name=p.independent_validator_name or "",
            status=LABELS[p.status],
            duration_weeks=_week(p.start_date, p.end_date),
            start_date=to_date_str(p.start_date),
            completion_date=to_date_str(completed.get(p.id)) or None,
            total_budget=float(p.budget_cap or 0),
            milestones=[_milestone_out(m, p.start_date) for m in p.milestones],
        ))
    return out


def list_pilots(db: Session, user: User) -> list[PilotOut]:
    stmt = _visible_to(_base_query(), user).order_by(Pilot.created_at.desc())
    return to_out(db, db.scalars(stmt).unique().all())


def get_pilot(db: Session, user: User, id_or_code: str) -> Pilot:
    """By UUID or code (PLT-2026-001), like api.ts getPilot(). Pilots the user may not see are 404."""
    try:
        condition = Pilot.id == uuid.UUID(id_or_code)
    except ValueError:
        condition = Pilot.code == id_or_code.upper()
    # populate_existing: re-read rows already in the session, so a response built right
    # after a change never shows stale milestones.
    stmt = _visible_to(_base_query(), user).where(condition).execution_options(populate_existing=True)
    pilot = db.scalars(stmt).unique().one_or_none()
    if pilot is None:
        raise _not_found()
    return pilot


def pilot_out(db: Session, user: User, pilot_id: uuid.UUID) -> PilotOut:
    return to_out(db, [get_pilot(db, user, str(pilot_id))])[0]


def check_owner(user: User, pilot: Pilot) -> None:
    """Only the officer who posted the pilot's problem manages the pilot."""
    if user.role != "govt_officer" or pilot.problem.posted_by != user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Only the officer who posted this problem can manage its pilot"
        )


def create_pilot(db: Session, officer: User, req: PilotCreate) -> uuid.UUID:
    try:
        solution_id = uuid.UUID(req.solution_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Solution not found")
    solution = db.get(SolutionAbstract, solution_id)
    if solution is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Solution not found")
    problem = db.get(Problem, solution.problem_id)
    if problem.posted_by != officer.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Only the officer who posted this problem can approve a pilot for it"
        )
    eligibility.ensure_not_ineligible(db, solution, "approved for a pilot")
    if db.scalar(select(Pilot.id).where(Pilot.solution_id == solution.id)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="A pilot already exists for this proposal")

    start = _today()
    pilot = Pilot(
        problem_id=problem.id,
        startup_id=solution.startup_id,
        solution_id=solution.id,
        independent_validator_name=req.independent_validator_name.strip(),
        objective=problem.desired_outcome,
        budget_cap=req.total_budget,
        start_date=start,
        end_date=start + timedelta(weeks=req.duration_weeks),
    )
    db.add(pilot)
    db.flush()  # get pilot.id for the milestones and history rows
    for m in sorted(req.milestones, key=lambda m: m.sequence):
        amount = (req.total_budget * m.tranche_percentage / 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        db.add(PilotMilestone(
            pilot_id=pilot.id,
            sequence=m.sequence,
            title=m.title.strip(),
            description=m.description.strip(),
            target_kpi=m.target_kpi.strip(),
            due_date=start + timedelta(weeks=m.deliverable_due_week),
            tranche_amount=amount,
            tranche_percentage=m.tranche_percentage,
        ))
    # Approving the proposal in the UI is the officer proposing, reviewing and approving the
    # pilot in one step; the history shows each step so the audit trail has no gaps.
    pilot_state_machine.record(db, pilot, None, "proposed", officer)
    pilot.status = "proposed"
    for target in ("under_review", "approved"):
        pilot_state_machine.transition(db, pilot, target, officer)
    solution.status = "shortlisted"
    problem.status = "pilot_active"
    try:
        db.commit()
    except IntegrityError:
        # Two approvals racing past the check above: UNIQUE (solution_id) is the real guard.
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail="A pilot already exists for this proposal")
    return pilot.id


def update_status(db: Session, officer: User, pilot: Pilot, target_label: str) -> None:
    check_owner(officer, pilot)
    target = pilot_state_machine.FROM_LABEL[target_label]
    if pilot.status == "approved" and target == "active":
        # The trial clock starts when the pilot does: shift the dates so the milestone due
        # weeks stay the same relative to the real start.
        shift = _today() - pilot.start_date if pilot.start_date else timedelta(0)
        if shift:
            pilot.start_date += shift
            pilot.end_date = pilot.end_date + shift if pilot.end_date else None
            for m in pilot.milestones:
                if m.due_date:
                    m.due_date += shift
    pilot_state_machine.transition(db, pilot, target, officer)
    db.commit()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _milestone(pilot: Pilot, milestone_id: uuid.UUID) -> PilotMilestone:
    for m in pilot.milestones:
        if m.id == milestone_id:
            return m
    raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Milestone not found")


def _require_active(pilot: Pilot, action: str) -> None:
    if pilot.status != "active":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f'Milestones can only be {action} while the pilot is Active (it is "{LABELS[pilot.status]}").',
        )


def submit_deliverable(db: Session, pilot: Pilot, milestone_id: uuid.UUID, req: DeliverableSubmit) -> None:
    # The route is startup-only and get_pilot() already hides other startups' pilots.
    _require_active(pilot, "submitted")
    m = _milestone(pilot, milestone_id)
    # pending -> submitted, failed -> submitted (resubmission), submitted -> submitted (replace
    # before review). A verified milestone is final.
    if m.status == "verified":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="This milestone is already verified")
    m.achieved_kpi = req.achieved_kpi
    m.evidence_url = req.file_url
    m.status = "submitted"
    # A resubmission needs a fresh verification.
    m.verified_by = m.verified_by_name = m.verified_at = None
    m.verification_remarks = m.verification_report_url = None
    db.commit()


def verify_milestone(db: Session, user: User, pilot: Pilot, milestone_id: uuid.UUID, req: MilestoneVerify) -> None:
    if user.role == "govt_officer":
        check_owner(user, pilot)
    # Conflict of interest: whoever scored this proposal can't also validate its delivery.
    scored = db.scalar(
        select(func.count()).select_from(Evaluation).where(
            Evaluation.solution_id == pilot.solution_id, Evaluation.evaluator_id == user.id
        )
    )
    if scored:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Conflict of interest: you scored this proposal's rubric, so you can't verify its milestones",
        )
    _require_active(pilot, "verified")
    m = _milestone(pilot, milestone_id)
    if m.status != "submitted":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f'Only a submitted milestone can be verified or failed (this one is "{m.status}")',
        )
    m.status = req.status
    m.verified_by = user.id
    m.verified_by_name = req.verified_by.strip()
    m.verified_at = _now()
    m.verification_remarks = req.remarks
    m.verification_report_url = req.verification_report_url
    if req.status == "verified":
        # Verification releases the milestone's tranche.
        m.tranche_disbursed = True
        m.disbursed_at = _now()
        if all(x.status == "verified" for x in pilot.milestones):
            pilot_state_machine.transition(db, pilot, "completed", user)
    else:
        pilot.failed_milestones_count = (pilot.failed_milestones_count or 0) + 1
    db.commit()


def disburse_tranche(db: Session, officer: User, pilot: Pilot, milestone_id: uuid.UUID) -> None:
    check_owner(officer, pilot)
    m = _milestone(pilot, milestone_id)
    if m.status != "verified":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="A tranche can only be disbursed for a verified milestone"
        )
    if not m.tranche_disbursed:  # verification normally does this already; repeating it is a no-op
        m.tranche_disbursed = True
        m.disbursed_at = _now()
        db.commit()
