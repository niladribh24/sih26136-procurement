"""seed.py end to end with the ML service down (FakeML's default). Runs inside the rolled-back
test transaction, so any demo data already in sih_db is untouched afterwards."""

from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

import seed
from app.models import EligibilityCheck, Problem, SolutionAbstract, StartupDocument, StartupProfile, User


def _count(db: Session, stmt) -> int:
    return db.scalar(select(func.count()).select_from(stmt.subquery()))


def _seeded_users(db: Session):
    return select(User).where(seed.seeded_users_filter())


def test_seed_with_ml_down(db: Session, upload_dir: Path):
    seed.clear(db)  # in case the dev database already has the demo data
    assert not seed.is_seeded(db)

    problems = seed.seed(db)
    assert seed.is_seeded(db)

    assert _count(db, _seeded_users(db).where(User.role != "startup")) == 3
    assert _count(db, _seeded_users(db).where(User.role == "startup")) == 5
    profile_ids = select(StartupProfile.id).join(User).where(seed.seeded_users_filter())
    assert _count(db, select(StartupDocument).where(StartupDocument.startup_id.in_(profile_ids))) == 8
    assert len(problems) == 4
    problem_ids = [p.id for p in problems.values()]
    solutions = db.scalars(select(SolutionAbstract).where(SolutionAbstract.problem_id.in_(problem_ids))).all()
    assert len(solutions) == 9
    assert len(list(upload_dir.rglob("*.pdf"))) == 8 + 9

    # ML down: nothing extracted, summarized or ranked.
    assert all(s.match_score is None and s.ai_summary is None for s in solutions)

    checks = {c.solution_id: c for c in db.scalars(select(EligibilityCheck))}
    by_title = {s.title: checks[s.id] for s in solutions}
    for c in by_title.values():
        assert {r["rule"]: r["status"] for r in c.rule_results}["domain"] == "pending"
    # The one failure that doesn't depend on ML: TRL-5 claimed against TRL-6.
    trl_fail = by_title["WhatsApp crop advisory service for paddy FPO members"]
    assert trl_fail.trl_ok is False and trl_fail.overall_eligible is False
    assert sum(c.trl_ok is False for c in by_title.values()) == 1
    assert all(c.dpiit_ok and c.turnover_ok for c in by_title.values())


def test_generated_pdfs_have_text():
    from io import BytesIO

    from pypdf import PdfReader

    doc = seed.STARTUPS[0].docs[0]
    reader = PdfReader(BytesIO(seed.make_pdf(doc.title, doc.body * 3)))  # long enough for 2+ pages
    assert len(reader.pages) >= 2
    text = "\n".join(p.extract_text() for p in reader.pages)
    assert "Magnaporthe" in text and "Kharif" in text


def test_clear_removes_rows_and_files(db: Session, upload_dir: Path):
    seed.clear(db)
    seed.seed(db)
    counts = seed.clear(db)

    assert counts["users"] == 8 and counts["problems"] == 4 and counts["solutions"] == 9
    assert not seed.is_seeded(db)
    assert _count(db, select(Problem).where(Problem.title == seed.PROBLEMS[0]["title"])) == 0
    assert list(upload_dir.rglob("*.pdf")) == []
