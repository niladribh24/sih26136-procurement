"""Runs the ML pipelines and stores their results. Shared by the endpoints (right after an
upload/submission) and retry_ml.py (for anything left pending while the ML service was down).

Every function here commits its own writes and raises MLUnavailable *before* changing
anything, so a failed call leaves the row exactly as it was: pending.
"""

import logging
from decimal import Decimal
from pathlib import Path

from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Problem, SolutionAbstract, StartupDocument, StartupProfile
from app.schemas.common import int_to_trl
from app.services import eligibility, ml_client
from app.services.ml_client import MLUnavailable
from app.services.uploads import upload_path

logger = logging.getLogger(__name__)

# Below this, the PDF is treated as having no usable text layer (e.g. a scan) and the
# abstract is summarized instead.
MIN_PDF_TEXT_CHARS = 200
# Enough for a good summary; keeps the request small for a 10 MB PDF.
MAX_SUMMARY_TEXT_CHARS = 15_000
# /summarize rejects anything shorter with a 422.
ML_MIN_TEXT_CHARS = 20


# ---------- /extract: startup documents → document + profile ----------

def _dedupe(items: list[str]) -> list[str]:
    seen, out = set(), []
    for item in items:
        if item.lower() not in seen:
            seen.add(item.lower())
            out.append(item)
    return out


def refresh_profile(db: Session, profile: StartupProfile) -> None:
    """Recompute the profile's tags/skills/domain from all its extracted documents."""
    db.flush()  # make the just-stored extract_result visible to the query below
    results = [
        r
        for r in db.scalars(
            select(StartupDocument.extract_result)
            .where(StartupDocument.startup_id == profile.id, StartupDocument.extract_result.is_not(None))
            .order_by(StartupDocument.uploaded_at.desc())
        )
    ]
    profile.extracted_tags = _dedupe([t for r in results for t in r["tags"]])
    profile.extracted_skills = _dedupe([s for r in results for s in r["skills"]])
    # The most confident classification wins; one vague document shouldn't flip the domain.
    profile.domain = max(results, key=lambda r: r["confidence"])["domain"] if results else None


def run_extract(db: Session, doc: StartupDocument) -> None:
    result = ml_client.extract(upload_path(doc.file_path), doc.original_filename or "document.pdf")
    doc.extract_result = result.model_dump()
    refresh_profile(db, db.get(StartupProfile, doc.startup_id))
    db.commit()
    # The domain may have just been classified: settle any eligibility checks waiting on it.
    eligibility.reevaluate_pending(db, doc.startup_id)


# ---------- /summarize: solution PDF → ai_summary ----------

def pdf_text(path: Path) -> str:
    """The PDF's text layer, or "" if it has none or can't be read."""
    parts, size = [], 0
    try:
        for page in PdfReader(path).pages:
            text = page.extract_text() or ""
            parts.append(text)
            size += len(text)
            if size >= MAX_SUMMARY_TEXT_CHARS:  # don't parse 200 pages to use the first few
                break
    except Exception as e:  # pypdf raises a variety of errors on malformed files
        logger.warning("Couldn't read text from %s: %s", path, e)
        return ""
    return "\n".join(parts).strip()


def summary_input(solution: SolutionAbstract) -> str:
    """Text from the solution PDF; the abstract if the PDF has too little text."""
    text = pdf_text(upload_path(solution.file_path)) if solution.file_path else ""
    if len(text) < MIN_PDF_TEXT_CHARS:
        text = (solution.abstract_text or "").strip()
        if len(text) < ML_MIN_TEXT_CHARS:
            text = f"{solution.title or ''}. {text}".strip(". ")
    return text[:MAX_SUMMARY_TEXT_CHARS]


def run_summarize(db: Session, solution: SolutionAbstract) -> bool:
    """False if there's too little text to summarize at all (nothing is sent)."""
    text = summary_input(solution)
    if len(text) < ML_MIN_TEXT_CHARS:
        return False
    result = ml_client.summarize(str(solution.id), text)
    solution.summary_result = result.model_dump()
    solution.ai_summary = result.summary
    db.commit()
    return True


# ---------- /rank: a problem's solutions → match_score + rank_result ----------

def has_unranked(db: Session, problem_id) -> bool:
    return (
        db.scalar(
            select(SolutionAbstract.id)
            .where(SolutionAbstract.problem_id == problem_id, SolutionAbstract.rank_result.is_(None))
            .limit(1)
        )
        is not None
    )


def rank_problem(db: Session, problem: Problem) -> int:
    """Rank all of a problem's solutions in one /rank call. Returns how many were scored."""
    solutions = db.scalars(select(SolutionAbstract).where(SolutionAbstract.problem_id == problem.id)).all()
    if not solutions:
        return 0  # /rank rejects an empty candidate list

    response = ml_client.rank(
        {
            "id": str(problem.id),
            "title": problem.title,
            "description": problem.description,
            "desired_outcome": problem.desired_outcome,
            "domain": problem.domain,
            "target_trl": int_to_trl(problem.trl_expected) or None,
        },
        [
            {
                "solution_id": str(s.id),
                "title": s.title or "",
                "abstract": s.abstract_text or "",
                "claimed_trl": int_to_trl(s.claimed_trl) or None,
            }
            for s in solutions
        ],
    )
    by_id = {r.solution_id: r for r in response.results}
    for s in solutions:
        if (r := by_id.get(str(s.id))) is not None:
            # str() first: Decimal(0.8123) would carry float noise like 0.81229999999...
            s.match_score = Decimal(str(r.match_score))
            s.rank_result = r.model_dump()
    db.commit()
    return len(by_id)


# ---------- retry_ml.py ----------

def retry_pending(db: Session) -> dict[str, tuple[int, int]]:
    """Re-run everything left pending. Returns {pipeline: (succeeded, attempted)}."""
    counts = {}

    docs = db.scalars(select(StartupDocument).where(StartupDocument.extract_result.is_(None))).all()
    counts["extract"] = (sum(_try(run_extract, db, d) for d in docs), len(docs))

    sols = db.scalars(select(SolutionAbstract).where(SolutionAbstract.ai_summary.is_(None))).all()
    counts["summarize"] = (sum(_try(run_summarize, db, s) for s in sols), len(sols))

    problems = db.scalars(
        select(Problem).where(
            Problem.id.in_(select(SolutionAbstract.problem_id).where(SolutionAbstract.rank_result.is_(None)))
        )
    ).all()
    counts["rank"] = (sum(_try(rank_problem, db, p) for p in problems), len(problems))

    # Last, so it sees the domains extract just filled in. Picks up solutions submitted
    # before the engine existed, and checks still waiting on something. "Done" = nothing
    # left pending.
    sols = eligibility.pending_or_unchecked(db)
    counts["eligibility"] = (
        sum(eligibility.is_settled(eligibility.run_for_solution(db, s)) for s in sols),
        len(sols),
    )
    return counts


def _try(fn, db: Session, obj) -> bool:
    try:
        return fn(db, obj) is not False
    except MLUnavailable:
        db.rollback()
        return False
