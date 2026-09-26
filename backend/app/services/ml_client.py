"""Thin httpx wrapper around the ML service (nlp/, see docs/ml_service.md).

Every failure — service down, timeout, non-2xx, a response that doesn't match the expected
shape — becomes MLUnavailable. Callers catch it and leave the ML fields pending; nothing a
user does should fail just because the ML service is having a bad moment.
"""

import logging
from pathlib import Path
from typing import Any, get_args

import httpx
from pydantic import BaseModel

from app.config import get_settings
from app.schemas.ml import ExtractResult, RankResponse, SummarizeResult
from app.schemas.problem import Domain

logger = logging.getLogger(__name__)

# The frontend's six domains, so /extract classifies into values Problem.domain can match.
TARGET_DOMAINS = ",".join(get_args(Domain))


class MLUnavailable(Exception):
    pass


def _client() -> httpx.Client:
    # One place that builds the client, so tests can swap in a mock transport.
    settings = get_settings()
    return httpx.Client(
        base_url=settings.ml_service_url,
        # Fail fast if nothing is listening; allow a slow answer once connected.
        timeout=httpx.Timeout(settings.ml_timeout_seconds, connect=2.0),
    )


def _post[T: BaseModel](path: str, model: type[T], **kwargs: Any) -> T:
    try:
        with _client() as client:
            res = client.post(path, **kwargs)
            res.raise_for_status()
            return model.model_validate(res.json())
    # httpx.HTTPError: connection refused, timeout, 4xx/5xx. ValueError: bad JSON or a
    # response that fails validation (pydantic's ValidationError is a ValueError).
    except (httpx.HTTPError, ValueError) as e:
        logger.warning("ML service %s failed: %s", path, e)
        raise MLUnavailable(f"{path}: {e}") from e


def extract(pdf_path: Path, filename: str) -> ExtractResult:
    # Send the PDF itself: the ML service does its own text extraction (with OCR for scans).
    with pdf_path.open("rb") as f:
        return _post(
            "/extract",
            ExtractResult,
            files={"file": (filename, f, "application/pdf")},
            data={"target_domains": TARGET_DOMAINS},
        )


def summarize(solution_id: str, text: str) -> SummarizeResult:
    return _post("/summarize", SummarizeResult, json={"solution_id": solution_id, "text": text, "max_sentences": 3})


def rank(problem: dict[str, Any], candidates: list[dict[str, Any]]) -> RankResponse:
    return _post("/rank", RankResponse, json={"problem": problem, "candidates": candidates})
