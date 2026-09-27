"""Re-run ML work left pending while the ML service was down.

    python retry_ml.py

Extracts pending startup documents, summarizes pending solutions, ranks every problem
that has an unscored solution, and re-runs eligibility checks that were waiting on ML (the
startup's domain) or never ran. Safe to run any time: finished items are skipped.
"""

from app.database import SessionLocal
from app.services.ml_sync import retry_pending


def main() -> None:
    with SessionLocal() as db:
        counts = retry_pending(db)
    for pipeline, (done, attempted) in counts.items():
        unit = "problems" if pipeline == "rank" else "items"
        print(f"{pipeline:9} {done}/{attempted} {unit} done")


if __name__ == "__main__":
    main()
