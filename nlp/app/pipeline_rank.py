"""
Pipeline 3 — Semantic Match Ranking & Keyword Attribution (POST /rank)

match_score / semantic_breakdown:
  - problem_relevance    = cosine(problem.description, candidate.abstract)
  - technical_feasibility = cosine(problem.desired_outcome, candidate.abstract),
                            nudged by a TRL-distance bonus/penalty
  - operational_alignment = cosine(problem.title, candidate.title)
  - match_score = weighted average of the three (see WEIGHTS below)

matched_keywords: KeyBERT phrases pulled independently from the problem
text and each candidate's abstract, paired up by embedding similarity
above MATCH_THRESHOLD — this is the "simple keyword-overlap highlighting"
the build notes call for, not attention-weight extraction.

A TF-IDF fallback (rank_fallback_tfidf) is provided per the SLA table so
the backend has something to call if the embedding models are mid-reload
or otherwise unavailable.
"""
from typing import List, Tuple

import numpy as np

from .models import get_embedder, get_keybert

WEIGHTS = {"problem_relevance": 0.4, "technical_feasibility": 0.4, "operational_alignment": 0.2}
KEYWORD_MATCH_THRESHOLD = 0.55
MAX_MATCHED_KEYWORDS = 6

TRL_ORDER = [f"TRL-{i}" for i in range(1, 10)]


def _cos(a: np.ndarray, b: np.ndarray) -> float:
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) or 1e-9
    return float(np.dot(a, b) / denom)


def _trl_bonus(target_trl, claimed_trl) -> float:
    """+0.05 for an exact TRL match, sliding penalty the further apart they are."""
    if not target_trl or not claimed_trl:
        return 0.0
    try:
        t_idx = TRL_ORDER.index(target_trl.upper())
        c_idx = TRL_ORDER.index(claimed_trl.upper())
    except ValueError:
        return 0.0
    distance = abs(t_idx - c_idx)
    return max(-0.15, 0.05 - 0.03 * distance)


def _keyphrases(text: str, top_n: int = 8) -> List[str]:
    kw_model = get_keybert()
    return [p for p, _ in kw_model.extract_keywords(
        text, keyphrase_ngram_range=(1, 3), stop_words="english", top_n=top_n, use_mmr=True, diversity=0.5
    )]


def _matched_keywords(problem_text: str, candidate_text: str) -> List[str]:
    embedder = get_embedder()
    p_phrases = _keyphrases(problem_text)
    c_phrases = _keyphrases(candidate_text)
    if not p_phrases or not c_phrases:
        return []

    p_emb = embedder.encode(p_phrases)
    c_emb = embedder.encode(c_phrases)

    matches, seen = [], set()
    for i, p_phrase in enumerate(p_phrases):
        sims = [_cos(p_emb[i], c_emb[j]) for j in range(len(c_phrases))]
        best_j = int(np.argmax(sims))
        if sims[best_j] >= KEYWORD_MATCH_THRESHOLD:
            label = c_phrases[best_j] if len(c_phrases[best_j]) <= len(p_phrase) else p_phrase
            if label.lower() not in seen:
                seen.add(label.lower())
                matches.append(label)
        if len(matches) >= MAX_MATCHED_KEYWORDS:
            break
    return matches


def _explanation(score: float, matched: List[str], target_trl, claimed_trl) -> str:
    if not matched:
        base = "Limited technical overlap detected with the stated problem requirements."
    elif score >= 0.8:
        base = f"Strong alignment on {', '.join(matched[:3])}."
    elif score >= 0.55:
        base = f"Partial alignment on {', '.join(matched[:3])}; some requirements remain unaddressed."
    else:
        base = f"Weak overlap — only {', '.join(matched[:2]) or 'minor terms'} matched the core requirement."

    if target_trl and claimed_trl and target_trl.upper() != claimed_trl.upper():
        base += f" Claimed {claimed_trl} against a target of {target_trl}."
    return base


def run_rank(problem: dict, candidates: List[dict]) -> List[dict]:
    embedder = get_embedder()

    prob_title_emb = embedder.encode(problem["title"])
    prob_desc_emb = embedder.encode(problem["description"])
    prob_outcome_emb = embedder.encode(problem["desired_outcome"])

    scored = []
    for cand in candidates:
        cand_title_emb = embedder.encode(cand["title"])
        cand_abstract_emb = embedder.encode(cand["abstract"])

        problem_relevance = _cos(prob_desc_emb, cand_abstract_emb)
        technical_feasibility = _cos(prob_outcome_emb, cand_abstract_emb) + _trl_bonus(
            problem.get("target_trl"), cand.get("claimed_trl")
        )
        operational_alignment = _cos(prob_title_emb, cand_title_emb)

        technical_feasibility = max(0.0, min(1.0, technical_feasibility))
        match_score = (
            WEIGHTS["problem_relevance"] * problem_relevance
            + WEIGHTS["technical_feasibility"] * technical_feasibility
            + WEIGHTS["operational_alignment"] * operational_alignment
        )
        match_score = max(0.0, min(1.0, match_score))

        matched = _matched_keywords(
            f"{problem['title']} {problem['description']} {problem['desired_outcome']}",
            f"{cand['title']} {cand['abstract']}",
        )

        scored.append({
            "solution_id": cand["solution_id"],
            "match_score": round(match_score, 4),
            "match_percent": round(match_score * 100),
            "match_explanation": _explanation(match_score, matched, problem.get("target_trl"), cand.get("claimed_trl")),
            "matched_keywords": matched,
            "semantic_breakdown": {
                "problem_relevance": round(problem_relevance, 4),
                "technical_feasibility": round(technical_feasibility, 4),
                "operational_alignment": round(operational_alignment, 4),
            },
        })

    scored.sort(key=lambda r: r["match_score"], reverse=True)
    for i, r in enumerate(scored, start=1):
        r["rank"] = i
    return scored


def rank_fallback_tfidf(problem: dict, candidates: List[dict]) -> List[dict]:
    """SLA-mandated fallback if the embedding models are unavailable/timing out."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    problem_text = f"{problem['title']} {problem['description']} {problem['desired_outcome']}"
    corpus = [problem_text] + [f"{c['title']} {c['abstract']}" for c in candidates]

    vectorizer = TfidfVectorizer(stop_words="english")
    matrix = vectorizer.fit_transform(corpus)
    sims = cosine_similarity(matrix[0:1], matrix[1:]).flatten()

    scored = []
    for cand, score in zip(candidates, sims):
        scored.append({
            "solution_id": cand["solution_id"],
            "match_score": round(float(score), 4),
            "match_percent": round(float(score) * 100),
            "match_explanation": "TF-IDF keyword-overlap fallback (semantic models unavailable).",
            "matched_keywords": [],
            "semantic_breakdown": {
                "problem_relevance": round(float(score), 4),
                "technical_feasibility": round(float(score), 4),
                "operational_alignment": round(float(score), 4),
            },
        })
    scored.sort(key=lambda r: r["match_score"], reverse=True)
    for i, r in enumerate(scored, start=1):
        r["rank"] = i
    return scored
