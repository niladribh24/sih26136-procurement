"""
Pipeline 2 — Executive Solution Summarization (POST /summarize)

Deliberately extractive + regex-based rather than a generative model:
it's deterministic, has no hallucination risk for numbers an officer
will act on, and comfortably clears the 800ms/2500ms SLA in the spec.
"""
import re
from typing import List

from .pipeline_extract import short_summary  # reuse the centroid-summary logic

CURRENCY_PATTERN = re.compile(
    r"(?:₹|Rs\.?|INR)\s?[\d,]+(?:\.\d+)?\s?(?:lakh|lakhs|crore|crores)?", re.IGNORECASE
)
DURATION_PATTERN = re.compile(
    r"\b\d+\s?(?:weeks?|months?|days?|phases?|milestones?)\b", re.IGNORECASE
)

# A "technical claim" sentence is one that carries a concrete, checkable
# spec: a number + unit/qualifier, or a hard performance/compliance word.
CLAIM_SIGNAL = re.compile(
    r"(\d+(\.\d+)?\s?(ms|%|km|cm|mm|fps|gb|mb|hours?|hrs?|db|watts?|kg))"
    r"|(real[\s-]?time|latency|encrypted|weatherized|ip6[0-9]|compliant|"
    r"redundant|fail[\s-]?safe|autonomous)",
    re.IGNORECASE,
)


def _split_sentences(text: str) -> List[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 15]


def extract_technical_claims(text: str, max_claims: int = 3) -> List[str]:
    claims = []
    for sentence in _split_sentences(text):
        if CLAIM_SIGNAL.search(sentence) and sentence not in claims:
            claims.append(sentence)
        if len(claims) >= max_claims:
            break
    return claims


def extract_cost_timeline(text: str) -> str:
    money = CURRENCY_PATTERN.findall(text)
    duration = DURATION_PATTERN.findall(text)
    money_str = money[0] if money else None
    duration_str = duration[0] if duration else None

    if money_str and duration_str:
        return f"{money_str} across {duration_str}."
    if money_str:
        return f"{money_str} (timeline not specified)."
    if duration_str:
        return f"Timeline: {duration_str} (cost not specified)."
    return "Not specified in document."


def run_summarize(solution_id: str, text: str, max_sentences: int = 3) -> dict:
    return {
        "solution_id": solution_id,
        "summary": short_summary(text, max_sentences=max_sentences),
        "technical_claims": extract_technical_claims(text),
        "cost_timeline_summary": extract_cost_timeline(text),
    }
