from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.auth import GOV_ROLES, get_current_user, require_role
from app.database import get_db
from app.models import User
from app.schemas.common import TRL
from app.schemas.problem import Domain, ProblemCreate, ProblemOut, ProblemStatus, ProblemUpdate
from app.schemas.solution import SolutionOut, SolutionSubmit
from app.services import ml_sync, problem_service, solution_service
from app.services.ml_client import MLUnavailable
from app.services.startup_service import get_profile

router = APIRouter(prefix="/api/problems", tags=["problems"])

officer_only = require_role("govt_officer")


def solution_form(
    title: str = Form(),
    abstract: str = Form(),
    claimed_trl: TRL = Form(alias="claimedTRL"),
    proposed_cost: Decimal = Form(alias="proposedCost"),
    proposed_duration_weeks: int = Form(alias="proposedDurationWeeks"),
) -> SolutionSubmit:
    """Reads the submit form's flat multipart fields. (A pydantic model used directly as
    Form() next to a File() param would be read as one nested field, not flat ones.)
    SolutionSubmit holds the actual rules; its errors become a normal 422."""
    try:
        return SolutionSubmit(
            title=title,
            abstract=abstract,
            claimed_trl=claimed_trl,
            proposed_cost=proposed_cost,
            proposed_duration_weeks=proposed_duration_weeks,
        )
    except ValidationError as e:
        raise RequestValidationError(e.errors(include_url=False))


@router.get("", response_model=list[ProblemOut])
def list_problems(
    domain: Domain | None = None,
    status_: ProblemStatus | None = Query(default=None, alias="status"),
    mine: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProblemOut]:
    return problem_service.list_problems(db, user, domain, status_, mine)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ProblemOut)
def create_problem(
    req: ProblemCreate, user: User = Depends(officer_only), db: Session = Depends(get_db)
) -> ProblemOut:
    problem = problem_service.create_problem(db, user, req)
    return problem_service.problem_out(db, problem)


@router.get("/{problem_id}", response_model=ProblemOut)
def get_problem(problem_id: str, _: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ProblemOut:
    return problem_service.problem_out(db, problem_service.get_problem(db, problem_id))


@router.patch("/{problem_id}", response_model=ProblemOut)
def edit_problem(
    problem_id: str, req: ProblemUpdate, user: User = Depends(officer_only), db: Session = Depends(get_db)
) -> ProblemOut:
    problem = problem_service.get_problem(db, problem_id)
    problem_service.update_problem(db, user, problem, req)
    return problem_service.problem_out(db, problem)


@router.post(
    "/{problem_id}/solutions",
    status_code=status.HTTP_201_CREATED,
    response_model=SolutionOut,
    response_model_exclude_none=True,
)
def submit_solution(
    problem_id: str,
    # Role first: dependencies run in order, so a wrong role gets 403 before the form is parsed.
    user: User = Depends(require_role("startup")),
    form: SolutionSubmit = Depends(solution_form),
    file: UploadFile = File(),
    db: Session = Depends(get_db),
) -> SolutionOut:
    problem = problem_service.get_problem(db, problem_id)
    solution_id = solution_service.submit_solution(db, get_profile(db, user.id), problem, form, file)
    return solution_service.to_out(db, [solution_service.get_solution(db, user, solution_id)])[0]


@router.get("/{problem_id}/solutions", response_model=list[SolutionOut], response_model_exclude_none=True)
def problem_solutions(
    problem_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[SolutionOut]:
    problem = problem_service.get_problem(db, problem_id)
    # Officers/evaluators see ranked results: if anything is unscored (new submissions, or
    # ML was down last time), rank the whole problem once, then list. If ML is still down,
    # the list comes back anyway with the unscored ones marked pending.
    if user.role in GOV_ROLES and ml_sync.has_unranked(db, problem.id):
        try:
            ml_sync.rank_problem(db, problem)
        except MLUnavailable:
            pass
    return solution_service.list_solutions(db, user, problem_id=problem.id, ranked=True)


@router.post("/{problem_id}/solutions/rank", response_model=list[SolutionOut], response_model_exclude_none=True)
def rank_solutions(
    problem_id: str,
    user: User = Depends(require_role("govt_officer", "evaluator")),
    db: Session = Depends(get_db),
) -> list[SolutionOut]:
    """Force a fresh ranking of every solution to this problem."""
    problem = problem_service.get_problem(db, problem_id)
    solution_service.check_can_manage(db, user, problem.id)
    try:
        ml_sync.rank_problem(db, problem)
    except MLUnavailable:
        # An explicit action should say it failed, unlike the silent fallback on listing.
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="ML service unavailable; try again later")
    return solution_service.list_solutions(db, user, problem_id=problem.id, ranked=True)
