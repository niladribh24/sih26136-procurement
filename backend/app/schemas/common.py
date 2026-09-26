"""Small conversions shared by the problem, solution and startup schemas."""

from datetime import date, datetime, timedelta, timezone
from typing import Literal

# frontend/lib/types.ts TRL. The DB stores the bare number (problems.trl_expected,
# solution_abstracts.claimed_trl); the API speaks "TRL-6".
TRL = Literal["TRL-3", "TRL-4", "TRL-5", "TRL-6", "TRL-7", "TRL-8", "TRL-9"]

# India has no daylight saving, so a fixed offset is exact — and it avoids needing the
# tzdata package, which Windows Python doesn't ship with.
IST = timezone(timedelta(hours=5, minutes=30))


def trl_to_int(trl: str) -> int:
    return int(trl.removeprefix("TRL-"))


def int_to_trl(n: int | None) -> str:
    return f"TRL-{n}" if n is not None else ""


def to_date_str(value: date | datetime | None) -> str:
    """YYYY-MM-DD, the format the frontend shows as-is (e.g. "Submitted: 2026-09-08").

    Timestamps are converted to IST first, so something submitted at 1 a.m. IST
    doesn't show up dated the previous day (UTC).
    """
    if value is None:
        return ""
    if isinstance(value, datetime):
        value = value.astimezone(IST).date()
    return value.isoformat()
