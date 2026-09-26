import uuid
from collections.abc import Sequence

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import Select, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, contains_eager

from app.models import Evaluation, Problem, SolutionAbstract, StartupProfile, User
from app.schemas.common import int_to_trl, to_date_str, trl_to_int
from app.schemas.solution import RubricScore, SolutionOut, SolutionSubmit
from app.services import ml_sync
from app.services.ml_client import MLUnavailable
from app.services.uploads import SOLUTIONS, delete_upload, save_pdf

# Solution (frontend/lib/types.ts) has no "pending" flag, so the explanation text says it.
PENDING_EXPLANATION = "AI match analysis pending."


def _duplicate() -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, detail="You have already submitted a proposal for this problem")


def _not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, detail="Solution not found")


def _base_query() -> Select:
    # One query loads each solution with its startup profile and that startup's user row
    # (for startupName). Without contains_eager, touching solution.startup.user in the loop
    # below would lazily fire two extra queries per solution.
    return (
        select(SolutionAbstract)
        .join(SolutionAbstract.startup)
        .join(StartupProfile.user)
        .options(contains_eager(SolutionAbstract.startup).contains_eager(StartupProfile.user))
    )


def _visible_to(stmt: Select, user: User) -> Select:
    # Startups only ever see their own proposals. Enforced here in the query, not left to
    # the frontend to filter, so a competitor's proposal never leaves the server.
    if user.role == "startup":
        stmt = stmt.where(StartupProfile.user_id == user.id)
    return stmt


def _latest_rubrics(db: Session, solution_ids: list[uuid.UUID]) -> dict[uuid.UUID, RubricScore]:
    """The most recent evaluation per solution — one query for the whole list."""
    rubrics: dict[uuid.UUID, RubricScore] = {}
    if not solution_ids:
        return rubrics
    evals = db.scalars(
        select(Evaluation)
        .where(Evaluation.solution_id.in_(solution_ids), Evaluation.total_score.is_not(None))
        .order_by(Evaluation.evaluated_at.desc())
    )
    for e in evals:
        if e.solution_id not in rubrics:  # newest first, so the first one seen wins
            rubrics[e.solution_id] = RubricScore(
                technical_merit=float(e.technical_merit),
                cost_realism=float(e.cost_realism),
                team_capability=float(e.team_capability),
                timeline_viability=float(e.timeline_viability),
                total=float(e.total_score),
            )
    return rubrics


def _out(s: SolutionAbstract, rubric: RubricScore | None) -> SolutionOut:
    profile = s.startup
    # rank_result is the ML /rank output; NULL until the solution is ranked (pending).
    rank = s.rank_result or {}
    return SolutionOut(
        id=str(s.id),
        problem_id=str(s.problem_id),
        startup_id=str(profile.user_id),
        startup_name=profile.user.org_name,
        dpiit_number=profile.dpiit_number or "",
        dpiit_verified=bool(profile.dpiit_verified),
        location=profile.location or "",
        title=s.title or "",
        abstract=s.abstract_text or "",
        claimed_trl=int_to_trl(s.claimed_trl),
        proposed_cost=float(s.proposed_cost or 0),
        proposed_duration_weeks=s.proposed_duration_weeks or 0,
        submitted_at=to_date_str(s.submitted_at),
        match_score=float(s.match_score or 0),
        match_explanation=rank.get("match_explanation", PENDING_EXPLANATION),
        matched_keywords=rank.get("matched_keywords", []),
        pdf_url=f"/api/solutions/{s.id}/pdf" if s.file_path else "",
        status=s.status,
        rubric_score=rubric,
    )


def to_out(db: Session, solutions: Sequence[SolutionAbstract]) -> list[SolutionOut]:
    rubrics = _latest_rubrics(db, [s.id for s in solutions])
    return [_out(s, rubrics.get(s.id)) for s in solutions]


def list_solutions(
    db: Session,
    user: User,
    problem_id: uuid.UUID | None = None,
    startup_user_id: uuid.UUID | None = None,
    ranked: bool = False,
) -> list[SolutionOut]:
    stmt = _visible_to(_base_query(), user)
    if problem_id:
        stmt = stmt.where(SolutionAbstract.problem_id == problem_id)
    if startup_user_id:
        stmt = stmt.where(StartupProfile.user_id == startup_user_id)
    if ranked:
        # Best match first; not-yet-scored (NULL) solutions last, oldest first among ties.
        stmt = stmt.order_by(SolutionAbstract.match_score.desc().nulls_last(), SolutionAbstract.submitted_at)
    else:
        stmt = stmt.order_by(SolutionAbstract.submitted_at.desc())
    return to_out(db, db.scalars(stmt).all())


def get_solution(db: Session, user: User, solution_id: uuid.UUID) -> SolutionAbstract:
    """A solution the user may see. Someone else's solution is a 404, not a 403, so a
    startup can't even learn that a competitor's proposal id exists."""
    solution = db.scalar(_visible_to(_base_query(), user).where(SolutionAbstract.id == solution_id))
    if solution is None:
        raise _not_found()
    return solution


def submit_solution(
    db: Session, profile: StartupProfile, problem: Problem, req: SolutionSubmit, file: UploadFile
) -> uuid.UUID:
    # Cheap check first, so an obvious duplicate is rejected before the upload is written.
    exists = db.scalar(
        select(SolutionAbstract.id).where(
            SolutionAbstract.problem_id == problem.id, SolutionAbstract.startup_id == profile.id
        )
    )
    if exists is not None:
        raise _duplicate()

    rel_path = save_pdf(file, SOLUTIONS)
    solution = SolutionAbstract(
        problem_id=problem.id,
        startup_id=profile.id,
        title=req.title,
        abstract_text=req.abstract,
        claimed_trl=trl_to_int(req.claimed_trl),
        proposed_cost=req.proposed_cost,
        proposed_duration_weeks=req.proposed_duration_weeks,
        file_path=rel_path,
    )
    db.add(solution)
    try:
        db.commit()
    except IntegrityError:
        # Two submissions racing past the check above: UNIQUE (problem_id, startup_id)
        # is the real guard.
        db.rollback()
        delete_upload(rel_path)
        raise _duplicate()
    except BaseException:
        db.rollback()
        delete_upload(rel_path)
        raise
    # Committed first, so the submission stands even if ML is down (summary stays pending).
    # Ranking isn't done here: it happens when an officer/evaluator lists the problem's
    # solutions, in one /rank call for all of them.
    try:
        ml_sync.run_summarize(db, solution)
    except MLUnavailable:
        pass
    # TODO(eligibility phase): run the eligibility rule engine here.
    return solution.id


def check_can_manage(db: Session, user: User, problem_id: uuid.UUID) -> None:
    # require_role on the route already limits callers to govt_officer / evaluator. An
    # evaluator may act on any problem's solutions; an officer only on their own problems.
    if user.role == "govt_officer":
        posted_by = db.scalar(select(Problem.posted_by).where(Problem.id == problem_id))
        if posted_by != user.id:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, detail="Only the officer who posted this problem can change this"
            )


def update_status(db: Session, user: User, solution: SolutionAbstract, new_status: str) -> None:
    check_can_manage(db, user, solution.problem_id)
    solution.status = new_status
    db.commit()
