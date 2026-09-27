"""The pilot status state machine (backend/docs/api_contract.md §3).

    proposed -> under_review -> approved -> active -> completed -> recommended_for_procurement -> procured
                                              |
                                              -> failed

TRANSITIONS is the complete list of legal moves; anything not in it is rejected with a 400.
transition() is the only code that may change pilots.status, and every change it makes is
recorded in pilot_status_history (who, from, to, when). frontend/lib/pilotStateMachine.ts
holds a copy of TRANSITIONS so the UI only offers legal moves; keep the two in sync.
"""

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Pilot, PilotStatusHistory, User

TRANSITIONS: dict[str, tuple[str, ...]] = {
    "proposed": ("under_review",),
    "under_review": ("approved",),
    "approved": ("active",),
    "active": ("completed", "failed"),
    "completed": ("recommended_for_procurement",),
    "recommended_for_procurement": ("procured",),
    "failed": (),
    "procured": (),
}

# DB enum value <-> frontend/lib/types.ts PilotStatus label.
LABELS: dict[str, str] = {
    "proposed": "Proposed",
    "under_review": "Under review",
    "approved": "Approved",
    "active": "Active",
    "completed": "Completed",
    "failed": "Failed",
    "recommended_for_procurement": "Recommended for procurement",
    "procured": "Procured",
}
FROM_LABEL: dict[str, str] = {label: value for value, label in LABELS.items()}


def can_transition(current: str, target: str) -> bool:
    return target in TRANSITIONS.get(current, ())


def record(db: Session, pilot: Pilot, from_status: str | None, to_status: str, user: User) -> None:
    db.add(PilotStatusHistory(pilot_id=pilot.id, from_status=from_status, to_status=to_status, changed_by=user.id))


def transition(db: Session, pilot: Pilot, target: str, user: User) -> None:
    """Move the pilot to `target` and record it. Doesn't commit: the caller commits, so a
    status change and whatever caused it (e.g. the last milestone being verified) are saved
    together or not at all."""
    current = pilot.status
    if not can_transition(current, target):
        allowed = ", ".join(LABELS[s] for s in TRANSITIONS.get(current, ())) or "none (final status)"
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f'Cannot move pilot from "{LABELS[current]}" to "{LABELS[target]}". Allowed next: {allowed}.',
        )
    if target == "completed":
        unverified = [m for m in pilot.milestones if m.status != "verified"]
        if unverified:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot complete the pilot: {len(unverified)} milestone(s) not verified yet.",
            )
    pilot.status = target
    record(db, pilot, current, target, user)


def completion_dates(db: Session, pilot_ids: list) -> dict:
    """When each pilot entered 'completed' — one query for the whole list."""
    if not pilot_ids:
        return {}
    rows = db.execute(
        select(PilotStatusHistory.pilot_id, func.max(PilotStatusHistory.changed_at))
        .where(PilotStatusHistory.pilot_id.in_(pilot_ids), PilotStatusHistory.to_status == "completed")
        .group_by(PilotStatusHistory.pilot_id)
    )
    return dict(rows.all())
