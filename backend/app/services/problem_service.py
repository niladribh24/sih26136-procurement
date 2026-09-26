import uuid

from fastapi import HTTPException, status
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models import Problem, SolutionAbstract, User
from app.schemas.common import int_to_trl, to_date_str, trl_to_int
from app.schemas.problem import ProblemCreate, ProblemOut, ProblemUpdate


def _with_submission_counts() -> Select:
    """SELECT problem, its solution count — in one query for any number of problems.

    Counting per problem in a Python loop would be one extra query per row (the "N+1"
    problem); grouping the counts in a subquery and LEFT JOINing it keeps it to one.
    LEFT (outer) join so problems with zero submissions still appear, with count NULL → 0.
    """
    counts = (
        select(SolutionAbstract.problem_id, func.count().label("n"))
        .group_by(SolutionAbstract.problem_id)
        .subquery()
    )
    return select(Problem, func.coalesce(counts.c.n, 0)).outerjoin(counts, counts.c.problem_id == Problem.id)


def _out(problem: Problem, submission_count: int) -> ProblemOut:
    return ProblemOut(
        id=str(problem.id),
        code=problem.code,
        title=problem.title,
        department=problem.department or "",
        ministry=problem.ministry or "",
        domain=problem.domain,
        description=problem.description,
        desired_outcome=problem.desired_outcome,
        budget_band=problem.budget_band or "",
        target_trl=int_to_trl(problem.trl_expected),
        deadline=to_date_str(problem.deadline),
        created_at=to_date_str(problem.created_at),
        submission_count=submission_count,
        status=problem.status,
    )


def list_problems(
    db: Session, user: User, domain: str | None, problem_status: str | None, mine: bool
) -> list[ProblemOut]:
    stmt = _with_submission_counts().order_by(Problem.created_at.desc())
    if domain:
        stmt = stmt.where(Problem.domain == domain)
    if problem_status:
        stmt = stmt.where(Problem.status == problem_status)
    if mine:
        stmt = stmt.where(Problem.posted_by == user.id)
    return [_out(p, n) for p, n in db.execute(stmt)]


def get_problem(db: Session, id_or_code: str) -> Problem:
    """Look up by UUID or by code (PRB-2026-081), like api.ts getProblem()."""
    try:
        condition = Problem.id == uuid.UUID(id_or_code)
    except ValueError:
        condition = Problem.code == id_or_code.upper()
    problem = db.scalar(select(Problem).where(condition))
    if problem is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Problem not found")
    return problem


def problem_out(db: Session, problem: Problem) -> ProblemOut:
    row = db.execute(_with_submission_counts().where(Problem.id == problem.id)).one()
    return _out(*row)


def create_problem(db: Session, officer: User, req: ProblemCreate) -> Problem:
    problem = Problem(
        posted_by=officer.id,
        title=req.title,
        department=req.department,
        ministry=req.ministry,
        domain=req.domain,
        description=req.description,
        desired_outcome=req.desired_outcome,
        budget_band=req.budget_band,
        trl_expected=trl_to_int(req.target_trl),
        deadline=req.deadline,
    )
    db.add(problem)
    db.commit()
    # code, status and created_at are filled in by Postgres defaults; read them back.
    db.refresh(problem)
    return problem


def update_problem(db: Session, officer: User, problem: Problem, req: ProblemUpdate) -> None:
    if problem.posted_by != officer.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="You can only edit problems you posted")
    changes = req.model_dump(exclude_unset=True)
    if "target_trl" in changes:
        changes["trl_expected"] = trl_to_int(changes.pop("target_trl"))
    for field, value in changes.items():
        setattr(problem, field, value)
    db.commit()
