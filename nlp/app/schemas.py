"""
Pydantic models for the SAMARTH NLP microservice.
These shapes are locked to docs/NLP_UI_REQUIREMENTS.md in the main repo —
do not rename fields without updating the backend client too.
"""
from typing import List, Optional
from pydantic import BaseModel, Field


# ---------- /extract ----------

class ExtractResponse(BaseModel):
    domain: str
    confidence: float
    tags: List[str]
    skills: List[str]
    summary: str
    extracted_trl_estimate: str
    ocr_performed: bool = False


# ---------- /summarize ----------

class SummarizeRequest(BaseModel):
    solution_id: str
    text: str
    max_sentences: int = 3


class SummarizeResponse(BaseModel):
    solution_id: str
    summary: str
    technical_claims: List[str]
    cost_timeline_summary: str


# ---------- /rank ----------

class ProblemIn(BaseModel):
    id: str
    title: str
    description: str
    desired_outcome: str
    domain: Optional[str] = None
    target_trl: Optional[str] = None


class CandidateIn(BaseModel):
    solution_id: str
    title: str
    abstract: str
    claimed_trl: Optional[str] = None


class RankRequest(BaseModel):
    problem: ProblemIn
    candidates: List[CandidateIn]


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
    matched_keywords: List[str]
    semantic_breakdown: SemanticBreakdown


class RankResponse(BaseModel):
    problem_id: str
    results: List[RankResult]
