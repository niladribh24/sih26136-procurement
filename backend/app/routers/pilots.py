import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.auth import GOV_ROLES, get_current_user, require_role
from app.database import get_db
from app.models import User
from app.schemas.pilot import AuditEntryIn, DeliverableSubmit, MilestoneVerify, PilotCreate, PilotOut, PilotStatusUpdate
from app.services import pilot_service

router = APIRouter(prefix="/api/pilots", tags=["pilots"])

# exclude_none: optional Pilot/Milestone fields (completionDate, verifiedBy, ...) are omitted
# until they have a value, like the TS `?:`.
PILOT_RESPONSE = {"response_model": PilotOut, "response_model_exclude_none": True}

officer_only = require_role("govt_officer")


@router.post("", status_code=status.HTTP_201_CREATED, **PILOT_RESPONSE)
def create_pilot(req: PilotCreate, user: User = Depends(officer_only), db: Session = Depends(get_db)) -> PilotOut:
    """api.ts createPilot: approving a proposal. Creates the pilot (status Approved) with its
    milestones, and shortlists the proposal."""
    pilot_id = pilot_service.create_pilot(db, user, req)
    return pilot_service.pilot_out(db, user, pilot_id)


@router.get("", response_model=list[PilotOut], response_model_exclude_none=True)
def list_pilots(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[PilotOut]:
    return pilot_service.list_pilots(db, user)


@router.get("/{pilot_id}", **PILOT_RESPONSE)
def get_pilot(pilot_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> PilotOut:
    return pilot_service.to_out(db, [pilot_service.get_pilot(db, user, pilot_id)])[0]


@router.patch("/{pilot_id}/status", **PILOT_RESPONSE)
def update_pilot_status(
    pilot_id: str, req: PilotStatusUpdate, user: User = Depends(officer_only), db: Session = Depends(get_db)
) -> PilotOut:
    """Only legal moves are accepted (app/services/pilot_state_machine.py); others are a 400."""
    pilot = pilot_service.get_pilot(db, user, pilot_id)
    pilot_service.update_status(db, user, pilot, req.status)
    return pilot_service.pilot_out(db, user, pilot.id)


@router.patch("/{pilot_id}/milestones/{milestone_id}/deliverable", **PILOT_RESPONSE)
def submit_deliverable(
    pilot_id: str,
    milestone_id: uuid.UUID,
    req: DeliverableSubmit,
    user: User = Depends(require_role("startup")),
    db: Session = Depends(get_db),
) -> PilotOut:
    pilot = pilot_service.get_pilot(db, user, pilot_id)
    pilot_service.submit_deliverable(db, pilot, milestone_id, req)
    return pilot_service.pilot_out(db, user, pilot.id)


@router.patch("/{pilot_id}/milestones/{milestone_id}/verify", **PILOT_RESPONSE)
def verify_milestone(
    pilot_id: str,
    milestone_id: uuid.UUID,
    req: MilestoneVerify,
    user: User = Depends(require_role("govt_officer", "evaluator")),
    db: Session = Depends(get_db),
) -> PilotOut:
    pilot = pilot_service.get_pilot(db, user, pilot_id)
    pilot_service.verify_milestone(db, user, pilot, milestone_id, req)
    return pilot_service.pilot_out(db, user, pilot.id)


@router.patch("/{pilot_id}/milestones/{milestone_id}/disburse", **PILOT_RESPONSE)
def disburse_tranche(
    pilot_id: str, milestone_id: uuid.UUID, user: User = Depends(officer_only), db: Session = Depends(get_db)
) -> PilotOut:
    pilot = pilot_service.get_pilot(db, user, pilot_id)
    pilot_service.disburse_tranche(db, user, pilot, milestone_id)
    return pilot_service.pilot_out(db, user, pilot.id)


@router.post("/{pilot_id}/audit", status_code=status.HTTP_204_NO_CONTENT)
def log_audit_entry(
    pilot_id: str, req: AuditEntryIn, user: User = Depends(require_role(*GOV_ROLES)), db: Session = Depends(get_db)
) -> Response:
    """api.ts logAuditEntry: a free-form audit note on a pilot, stored with the caller's account."""
    pilot_service.log_audit(db, user, pilot_service.get_pilot(db, user, pilot_id), req)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
