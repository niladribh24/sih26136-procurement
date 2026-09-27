import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth import GOV_ROLES, get_current_user, require_role
from app.database import get_db
from app.models import User
from app.schemas.eligibility import EligibilityOut
from app.schemas.solution import SolutionOut, SolutionStatusUpdate
from app.services import eligibility, solution_service
from app.services.uploads import upload_path

router = APIRouter(prefix="/api/solutions", tags=["solutions"])

# exclude_none: rubricScore is omitted until the solution has been scored (TS `rubricScore?`).
SOLUTION_RESPONSE = {"response_model": SolutionOut, "response_model_exclude_none": True}


@router.get("", response_model=list[SolutionOut], response_model_exclude_none=True)
def list_solutions(
    problem_id: uuid.UUID | None = Query(default=None, alias="problemId"),
    startup_id: uuid.UUID | None = Query(default=None, alias="startupId"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SolutionOut]:
    """getSolutions(problemId?) and getProposalsByStartup(startupId). A startup gets only
    its own, whatever filters it sends."""
    return solution_service.list_solutions(db, user, problem_id=problem_id, startup_user_id=startup_id)


@router.get("/{solution_id}", **SOLUTION_RESPONSE)
def get_solution(
    solution_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> SolutionOut:
    return solution_service.to_out(db, [solution_service.get_solution(db, user, solution_id)])[0]


@router.patch("/{solution_id}/status", **SOLUTION_RESPONSE)
def update_solution_status(
    solution_id: uuid.UUID,
    req: SolutionStatusUpdate,
    user: User = Depends(require_role("govt_officer", "evaluator")),
    db: Session = Depends(get_db),
) -> SolutionOut:
    solution = solution_service.get_solution(db, user, solution_id)
    solution_service.update_status(db, user, solution, req.status)
    return solution_service.to_out(db, [solution])[0]


@router.get("/{solution_id}/pdf", response_class=FileResponse)
def solution_pdf(
    solution_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> FileResponse:
    # Same visibility as the solution itself: the submitting startup and government roles.
    solution = solution_service.get_solution(db, user, solution_id)
    path = upload_path(solution.file_path) if solution.file_path else None
    if path is None or not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="PDF not found")
    return FileResponse(path, media_type="application/pdf", filename=f"proposal-{solution.id}.pdf")


@router.get("/{solution_id}/eligibility", response_model=EligibilityOut)
def solution_eligibility(
    solution_id: uuid.UUID, user: User = Depends(require_role(*GOV_ROLES)), db: Session = Depends(get_db)
) -> EligibilityOut:
    solution = solution_service.get_solution(db, user, solution_id)
    check = eligibility.get_check(db, solution.id)
    if check is None:  # submitted before the engine existed
        check = eligibility.run_for_solution(db, solution)
    return eligibility.to_out(check)


@router.post("/{solution_id}/eligibility", response_model=EligibilityOut)
def rerun_eligibility(
    solution_id: uuid.UUID,
    user: User = Depends(require_role("govt_officer", "evaluator")),
    db: Session = Depends(get_db),
) -> EligibilityOut:
    """Re-run every rule against the current profile/problem, e.g. after the startup
    declared its turnover."""
    solution = solution_service.get_solution(db, user, solution_id)
    solution_service.check_can_manage(db, user, solution.problem_id)
    return eligibility.to_out(eligibility.run_for_solution(db, solution))
