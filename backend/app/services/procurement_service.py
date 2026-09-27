"""Procurement (Module 9): what gets written when a pilot moves to Procured.

pilot_service.update_status() calls record_procurement() right after the state machine's
transition to 'procured' and before the single commit, so the status change, its history
row, the procurement_records row and the proven_solutions row are saved together or not at
all. Nothing else creates these rows.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Pilot, ProcurementRecord, ProvenSolution
from app.schemas.common import IST
from app.services import eligibility, solution_service


def records_for(db: Session, pilot_ids: list[uuid.UUID]) -> dict[uuid.UUID, ProcurementRecord]:
    """Each pilot's procurement record, if it has one — one query for the whole list."""
    if not pilot_ids:
        return {}
    rows = db.scalars(select(ProcurementRecord).where(ProcurementRecord.pilot_id.in_(pilot_ids)))
    return {r.pilot_id: r for r in rows}


def order_ref(record: ProcurementRecord, pilot: Pilot) -> str:
    """Pilot.sanctionOrderRef, e.g. SAN/2026/PLT-2026-235. Derived rather than stored: it's
    fully determined by the pilot's code and the procurement year."""
    year = (record.procured_at or datetime.now(timezone.utc)).astimezone(IST).year
    return f"SAN/{year}/{pilot.code}"


def record_procurement(db: Session, pilot: Pilot, performance_score: float | None) -> ProvenSolution:
    """Write the procurement record (with a compliance snapshot) and the proven solution.
    Doesn't commit: the caller commits together with the status change."""
    check = eligibility.get_check(db, pilot.solution_id)
    rubric = solution_service.latest_rubrics(db, [pilot.solution_id]).get(pilot.solution_id)
    verified = sum(m.status == "verified" for m in pilot.milestones)
    record = ProcurementRecord(
        pilot_id=pilot.id,
        status="issued",
        procured_at=datetime.now(timezone.utc),
        # What the decision rested on, frozen at procurement time (later edits to the
        # rubric or eligibility don't rewrite history).
        compliance_checklist={
            "eligibility_status": eligibility.to_out(check).status if check else "unchecked",
            "milestones_total": len(pilot.milestones),
            "milestones_verified": verified,
            "all_milestones_verified": verified == len(pilot.milestones),
            "failed_verifications": pilot.failed_milestones_count or 0,
            "rubric_total": rubric.total if rubric else None,
            "performance_score": performance_score,
        },
    )
    db.add(record)
    db.flush()  # get record.id for the proven solution
    proven = ProvenSolution(procurement_id=record.id)
    db.add(proven)
    db.flush()
    return proven
