"""Response shapes of the ML service (nlp/), copied from nlp/app/schemas.py — that file is the
source of truth. The backend validates every ML response against these, so if the nlp side
renames a field the call fails loudly (and the data stays "pending") instead of storing junk.
"""

from pydantic import BaseModel


class ExtractResult(BaseModel):
    domain: str
    confidence: float
    tags: list[str]
    skills: list[str]
    summary: str
    extracted_trl_estimate: str
    ocr_performed: bool = False


class SummarizeResult(BaseModel):
    solution_id: str
    summary: str
    technical_claims: list[str]
    cost_timeline_summary: str


class SemanticBreakdown(BaseModel):
    problem_relevance: float
    technical_feasibility: float
    operational_alignment: float


class RankResult(BaseModel):
    solution_id: str
    match_score: float
    match_percent: int
    rank: int
    match_explanation: str
    matched_keywords: list[str]
    semantic_breakdown: SemanticBreakdown


class RankResponse(BaseModel):
    problem_id: str
    results: list[RankResult]
