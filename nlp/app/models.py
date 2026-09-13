"""
Central place that loads every ML model exactly once and hands back
singletons. Import from here, never instantiate SentenceTransformer /
pipeline() / spacy.load() anywhere else — that's what causes a 4GB
reload on every request.
"""
import functools
import logging

logger = logging.getLogger("samarth-nlp.models")

DOMAINS = ["AgriTech", "GovTech", "Defence", "HealthTech", "CleanTech", "DroneTech"]


@functools.lru_cache(maxsize=1)
def get_embedder():
    from sentence_transformers import SentenceTransformer
    logger.info("Loading sentence-transformers/all-MiniLM-L6-v2 ...")
    return SentenceTransformer("all-MiniLM-L6-v2")


@functools.lru_cache(maxsize=1)
def get_zero_shot():
    from transformers import pipeline
    import torch
    device = 0 if torch.cuda.is_available() else -1
    logger.info("Loading facebook/bart-large-mnli (device=%s) ...", device)
    return pipeline("zero-shot-classification", model="facebook/bart-large-mnli", device=device)


@functools.lru_cache(maxsize=1)
def get_spacy():
    import spacy
    logger.info("Loading spaCy en_core_web_sm ...")
    try:
        return spacy.load("en_core_web_sm")
    except OSError as e:
        raise RuntimeError(
            "spaCy model 'en_core_web_sm' not found. Run: "
            "python -m spacy download en_core_web_sm"
        ) from e


@functools.lru_cache(maxsize=1)
def get_keybert():
    from keybert import KeyBERT
    logger.info("Loading KeyBERT (reusing MiniLM embedder) ...")
    return KeyBERT(model=get_embedder())


def preload_all():
    """Call once at FastAPI startup so the first real request isn't slow."""
    get_embedder()
    get_zero_shot()
    get_spacy()
    get_keybert()
