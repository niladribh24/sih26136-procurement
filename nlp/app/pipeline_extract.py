"""
Pipeline 1 — Capability & Tag Extraction (POST /extract)

domain      -> zero-shot classification against the 6 sovereign domains
tags        -> broader capability/technique phrases (KeyBERT + spaCy)
skills      -> specific named technologies/tools/protocols (acronyms,
               versioned names, proper nouns picked out of the same
               keyphrase pool)
summary     -> 1-2 sentence extractive summary (centroid-similarity)
trl         -> regex scan for an explicit "TRL-n" mention, else a
               conservative default
"""
import re
from typing import List, Optional, Tuple

from .models import DOMAINS, get_embedder, get_keybert, get_spacy, get_zero_shot

GENERIC_BUZZWORDS = {
    "scalable", "innovative", "end to end", "end-to-end", "cutting edge",
    "cutting-edge", "state of the art", "state-of-the-art", "robust",
    "seamless", "next generation", "next-generation", "solution", "platform",
}

TRL_PATTERN = re.compile(r"\bTRL[\s\-]?(\d{1,2})\b", re.IGNORECASE)

# A keyphrase gets bucketed into "skills" (named tech) rather than "tags"
# (general capability) if it looks like a proper-noun / model name / acronym:
# has a digit, is all-caps/mixed-case without spaces, or spaCy tags it as a
# proper noun / product.
SKILL_LIKE_PATTERN = re.compile(r"[A-Za-z]+\d|\d[A-Za-z]+|^[A-Z0-9]{2,6}$")


def _clean_phrase(p: str) -> str:
    return p.strip().strip(".,;:").strip()


def _looks_like_skill(phrase: str, doc_tokens) -> bool:
    if SKILL_LIKE_PATTERN.search(phrase.replace(" ", "")):
        return True
    # Proper-noun heuristic via spaCy POS on the matching tokens
    words = phrase.lower().split()
    for tok in doc_tokens:
        if tok.text.lower() in words and tok.pos_ == "PROPN":
            return True
    return False


def extract_trl(text: str) -> str:
    m = TRL_PATTERN.search(text)
    if m:
        return f"TRL-{m.group(1)}"
    return "TRL-4"  # conservative default when nothing explicit is stated


def classify_domain(text: str, target_domains: Optional[List[str]] = None) -> Tuple[str, float]:
    candidate_domains = target_domains or DOMAINS
    classifier = get_zero_shot()
    # Truncate to keep BART-MNLI inference fast; the first ~2000 chars of a
    # proposal carry the sector signal in practice.
    result = classifier(text[:2000], candidate_labels=candidate_domains, multi_label=False)
    return result["labels"][0], round(float(result["scores"][0]), 4)


def extract_tags_and_skills(text: str, top_n: int = 14) -> Tuple[List[str], List[str]]:
    kw_model = get_keybert()
    nlp = get_spacy()

    keyphrases = kw_model.extract_keywords(
        text,
        keyphrase_ngram_range=(1, 3),
        stop_words="english",
        top_n=top_n,
        use_mmr=True,
        diversity=0.6,
    )
    doc = nlp(text[:100_000])  # spaCy has a max doc length; cap defensively

    tags, skills = [], []
    seen = set()
    for phrase, _score in keyphrases:
        clean = _clean_phrase(phrase)
        low = clean.lower()
        if low in GENERIC_BUZZWORDS or low in seen or len(clean) < 3:
            continue
        seen.add(low)
        title_case = clean.title() if clean.islower() else clean
        if _looks_like_skill(clean, doc):
            skills.append(title_case)
        else:
            tags.append(title_case)

    # Keep within the 5-10 range the spec asks for; tags can run a little
    # longer since they double as the domain tag cloud.
    return tags[:10] or tags, skills[:10]


def short_summary(text: str, max_sentences: int = 2) -> str:
    """Centroid-similarity extractive summary — fast, deterministic,
    no generation model required."""
    import numpy as np
    from sklearn.metrics.pairwise import cosine_similarity

    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 20]
    if not sentences:
        return text[:280]
    if len(sentences) <= max_sentences:
        return " ".join(sentences)

    embedder = get_embedder()
    embeddings = embedder.encode(sentences)
    centroid = embeddings.mean(axis=0, keepdims=True)
    sims = cosine_similarity(embeddings, centroid).flatten()
    top_idx = sorted(np.argsort(sims)[-max_sentences:])
    return " ".join(sentences[i] for i in top_idx)


def run_extract(text: str, target_domains: Optional[List[str]] = None) -> dict:
    domain, confidence = classify_domain(text, target_domains)
    tags, skills = extract_tags_and_skills(text)
    return {
        "domain": domain,
        "confidence": confidence,
        "tags": tags,
        "skills": skills,
        "summary": short_summary(text),
        "extracted_trl_estimate": extract_trl(text),
    }
