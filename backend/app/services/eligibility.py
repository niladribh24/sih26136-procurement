"""Eligibility rule engine (Module 3). Every rule lives in this module.

Each rule is a plain function that takes an EligibilityContext and returns a RuleResult
(pass / fail / pending, plus a human-readable reason). To add a rule, write one function
decorated with @rule. It is picked up by evaluate() and stored in
eligibility_checks.rule_results automatically.

A rule with a `column` also sets that boolean column on eligibility_checks (pass -> TRUE,
fail -> FALSE, pending -> NULL). Postgres computes overall_eligible from those four
columns only, so a new rule without a column shows up in the API's `status` and
`rules` but not in overall_eligible until a column is added for it in schema.sql.

"Pending" means the data will come in by itself: today that's only the ML-classified
startup domain. Missing data the startup has to supply (e.g. turnover) is a fail with a
reason, and an officer can re-run the check once it's filled in.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import EligibilityCheck, Problem, SolutionAbstract, StartupDocument, StartupProfile
from app.schemas.auth import DPIIT_RE
from app.schemas.common import int_to_trl
from app.schemas.eligibility import EligibilityOut, RuleOut

RuleStatus = Literal["pass", "fail", "pending"]

# The frontend profile page caps startup eligibility at ₹25 Cr turnover
# (app/schemas/startup.py TurnoverBand lists every band it offers).
ELIGIBLE_TURNOVER_BANDS = ("< ₹1Cr", "₹1Cr–₹5Cr", "₹5Cr–₹25Cr")


@dataclass(frozen=True)
class RuleResult:
    status: RuleStatus
    reason: str


@dataclass(frozen=True)
class EligibilityContext:
    """Everything the rules look at, loaded once, so rules never query the DB themselves."""

    solution: SolutionAbstract
    profile: StartupProfile
    problem: Problem
    has_documents: bool
    has_pending_documents: bool  # uploaded, but ML /extract hasn't processed it yet


@dataclass(frozen=True)
class Rule:
    key: str
    label: str
    column: str | None  # eligibility_checks column this rule sets, if any
    check: Callable[[EligibilityContext], RuleResult]


RULES: list[Rule] = []


def rule(key: str, label: str, column: str | None = None):
    def register(fn: Callable[[EligibilityContext], RuleResult]) -> Callable[[EligibilityContext], RuleResult]:
        RULES.append(Rule(key, label, column, fn))
        return fn

    return register


def _pass(reason: str) -> RuleResult:
    return RuleResult("pass", reason)


def _fail(reason: str) -> RuleResult:
    return RuleResult("fail", reason)


def _pending(reason: str) -> RuleResult:
    return RuleResult("pending", reason)


# ---------- the rules ----------

@rule("dpiit", "DPIIT recognition", column="dpiit_ok")
def dpiit_rule(ctx: EligibilityContext) -> RuleResult:
    number = (ctx.profile.dpiit_number or "").strip().upper()
    if not number:
        return _fail("No DPIIT recognition number on the startup profile")
    if not DPIIT_RE.match(number):
        return _fail(f"DPIIT number {number} is not in a valid format (e.g. DIPP12345)")
    verified = "verified" if ctx.profile.dpiit_verified else "not yet verified"
    return _pass(f"DPIIT number {number} present ({verified})")


@rule("turnover", "Turnover within startup limit", column="turnover_ok")
def turnover_rule(ctx: EligibilityContext) -> RuleResult:
    band = ctx.profile.turnover_band
    if not band:
        return _fail("Turnover band not declared on the startup profile")
    if band in ELIGIBLE_TURNOVER_BANDS:
        return _pass(f"Turnover {band} is within the ₹25 Cr startup limit")
    if band == "> ₹25Cr":
        return _fail("Turnover above ₹25 Cr exceeds the startup limit")
    return _fail(f"Unrecognised turnover band {band!r}")


@rule("domain", "Startup domain matches problem", column="domain_ok")
def domain_rule(ctx: EligibilityContext) -> RuleResult:
    domain = ctx.profile.domain
    if not domain:
        if ctx.has_pending_documents:
            return _pending("Startup domain is still being classified from its uploaded documents")
        if not ctx.has_documents:
            return _pending("Startup has no uploaded documents to classify its domain from")
        return _pending("Startup domain not yet classified")
    if domain.strip().lower() == (ctx.problem.domain or "").strip().lower():
        return _pass(f"Startup domain {domain} matches the problem domain")
    return _fail(f"Startup domain {domain} does not match the problem domain {ctx.problem.domain}")


@rule("trl", "Claimed TRL meets requirement", column="trl_ok")
def trl_rule(ctx: EligibilityContext) -> RuleResult:
    expected, claimed = ctx.problem.trl_expected, ctx.solution.claimed_trl
    if expected is None:
        return _pass("Problem has no TRL requirement")
    if claimed is None:
        return _fail(f"No TRL claimed; {int_to_trl(expected)} expected")
    if claimed >= expected:
        return _pass(f"{int_to_trl(claimed)} claimed, {int_to_trl(expected)} expected")
    return _fail(f"{int_to_trl(claimed)} claimed is below the {int_to_trl(expected)} expected")


# ---------- engine ----------

def evaluate(ctx: EligibilityContext) -> list[tuple[Rule, RuleResult]]:
    """Run every rule. Pure: no DB access, so other modules can reuse it freely."""
    return [(r, r.check(ctx)) for r in RULES]


def overall_status(statuses: list[RuleStatus]) -> Literal["eligible", "ineligible", "pending"]:
    # Same logic as the overall_eligible column's three-valued AND.
    if "fail" in statuses:
        return "ineligible"
    if "pending" in statuses:
        return "pending"
    return "eligible"


def build_context(db: Session, solution: SolutionAbstract) -> EligibilityContext:
    profile = db.get(StartupProfile, solution.startup_id)
    problem = db.get(Problem, solution.problem_id)
    extract_results = db.scalars(
        select(StartupDocument.extract_result).where(StartupDocument.startup_id == profile.id)
    ).all()
    return EligibilityContext(
        solution=solution,
        profile=profile,
        problem=problem,
        has_documents=bool(extract_results),
        has_pending_documents=any(r is None for r in extract_results),
    )


def get_check(db: Session, solution_id) -> EligibilityCheck | None:
    return db.scalar(select(EligibilityCheck).where(EligibilityCheck.solution_id == solution_id))


def run_for_solution(db: Session, solution: SolutionAbstract) -> EligibilityCheck:
    """Evaluate every rule and store the result: one row per solution, updated in place."""
    results = evaluate(build_context(db, solution))
    check = get_check(db, solution.id)
    if check is None:
        check = EligibilityCheck(solution_id=solution.id)
        db.add(check)
    for r, result in results:
        if r.column:
            setattr(check, r.column, None if result.status == "pending" else result.status == "pass")
    check.rule_results = [{"rule": r.key, "status": res.status, "reason": res.reason} for r, res in results]
    check.checked_at = func.now()
    db.commit()
    db.refresh(check)  # read back overall_eligible (computed by Postgres) and checked_at
    return check


def _pending_filter():
    # A check still has something pending if any rule column is NULL.
    return or_(*(getattr(EligibilityCheck, r.column).is_(None) for r in RULES if r.column))


def is_settled(check: EligibilityCheck) -> bool:
    """True once no rule is pending (overall_eligible alone can't tell: a fail makes it
    FALSE even while another rule is still pending)."""
    return not any(r["status"] == "pending" for r in check.rule_results or [])


def pending_or_unchecked(db: Session, startup_profile_id=None) -> list[SolutionAbstract]:
    """Solutions with no check yet, or a check with a pending rule."""
    stmt = (
        select(SolutionAbstract)
        .outerjoin(EligibilityCheck, EligibilityCheck.solution_id == SolutionAbstract.id)
        .where(or_(EligibilityCheck.id.is_(None), _pending_filter()))
    )
    if startup_profile_id is not None:
        stmt = stmt.where(SolutionAbstract.startup_id == startup_profile_id)
    return list(db.scalars(stmt).all())


def reevaluate_pending(db: Session, startup_profile_id) -> int:
    """Re-run the startup's pending checks, e.g. once ML has filled in its domain."""
    solutions = pending_or_unchecked(db, startup_profile_id)
    for s in solutions:
        run_for_solution(db, s)
    return len(solutions)


def to_out(check: EligibilityCheck) -> EligibilityOut:
    labels = {r.key: r.label for r in RULES}
    rules = [
        RuleOut(rule=r["rule"], label=labels.get(r["rule"], r["rule"]), status=r["status"], reason=r["reason"])
        for r in check.rule_results or []
    ]
    return EligibilityOut(
        solution_id=str(check.solution_id),
        status=overall_status([r.status for r in rules]),
        overall_eligible=check.overall_eligible,
        checked_at=check.checked_at.isoformat() if check.checked_at else "",
        rules=rules,
    )
