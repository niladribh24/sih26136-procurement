import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.database import get_db
from app.models import User
from app.schemas.scale import ReplicationCreate, ReplicationRequestOut, ReplicationStatusUpdate, ScaleSolutionOut
from app.services import scale_service

router = APIRouter(prefix="/api", tags=["scale"])

# exclude_none: targetBudget / deploymentTimelineWeeks / totalBudget are optional in types.ts.
EXCLUDE_NONE = {"response_model_exclude_none": True}

officer_only = require_role("govt_officer")


@router.get("/proven-solutions", response_model=list[ScaleSolutionOut], **EXCLUDE_NONE)
def list_proven_solutions(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ScaleSolutionOut]:
    """api.ts getScaleSolutions."""
    return scale_service.list_proven(db, user)


@router.get("/replications", response_model=list[ReplicationRequestOut], **EXCLUDE_NONE)
def list_replications(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ReplicationRequestOut]:
    """api.ts getReplications. A startup sees only requests for its own solutions."""
    return scale_service.list_replications(db, user)


@router.post(
    "/replications", status_code=status.HTTP_201_CREATED, response_model=ReplicationRequestOut, **EXCLUDE_NONE
)
def create_replication(
    req: ReplicationCreate, user: User = Depends(officer_only), db: Session = Depends(get_db)
) -> ReplicationRequestOut:
    """api.ts createReplicationRequest: another department's officer asks to replicate a
    proven solution."""
    return scale_service.replication_out(db, scale_service.create_replication(db, user, req))


@router.patch("/replications/{request_id}/status", response_model=ReplicationRequestOut, **EXCLUDE_NONE)
def update_replication_status(
    request_id: uuid.UUID,
    req: ReplicationStatusUpdate,
    user: User = Depends(officer_only),
    db: Session = Depends(get_db),
) -> ReplicationRequestOut:
    """api.ts updateReplicationStatus: pending -> approved (originating officer),
    approved -> in_pilot (requesting officer)."""
    scale_service.update_replication_status(db, user, request_id, req.status)
    return scale_service.replication_out(db, request_id)
