import logging
import time
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .models import preload_all
from .pdf_extract import extract_text_from_pdf
from .pipeline_extract import run_extract
from .pipeline_rank import rank_fallback_tfidf, run_rank
from .pipeline_summarize import run_summarize
from .schemas import ExtractResponse, RankRequest, RankResponse, SummarizeRequest, SummarizeResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("samarth-nlp")

app = FastAPI(title="SAMARTH NLP Microservice", version="1.0.0")

# The backend is the only caller in production, but keep this open for
# local dev where the frontend or a teammate might hit :8001 directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    logger.info("Preloading models so the first real request isn't slow ...")
    t0 = time.time()
    try:
        preload_all()
        logger.info("Models loaded in %.1fs", time.time() - t0)
    except Exception as e:
        # Don't crash the service on boot — endpoints will error clearly
        # per-request instead, which is easier to debug during the hackathon.
        logger.error("Model preload failed: %s", e)


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.post("/extract", response_model=ExtractResponse)
async def extract(
    file: Optional[UploadFile] = File(default=None),
    text: Optional[str] = Form(default=None),
    target_domains: Optional[str] = Form(default=None),
):
    """target_domains, if provided, is a comma-separated string
    (multipart form fields don't carry native arrays)."""
    if not file and not text:
        raise HTTPException(400, "Provide either 'file' (PDF) or 'text'.")

    ocr_performed = False
    if file:
        pdf_bytes = await file.read()
        doc_text, ocr_performed = extract_text_from_pdf(pdf_bytes)
    else:
        doc_text = text

    if not doc_text or len(doc_text.strip()) < 20:
        raise HTTPException(422, "Could not extract usable text from the input.")

    domains_list: Optional[List[str]] = None
    if target_domains:
        domains_list = [d.strip() for d in target_domains.split(",") if d.strip()]

    try:
        result = run_extract(doc_text, target_domains=domains_list)
    except Exception as e:
        logger.exception("extract pipeline failed")
        raise HTTPException(500, f"Extraction pipeline error: {e}")

    result["ocr_performed"] = ocr_performed
    return result


@app.post("/summarize", response_model=SummarizeResponse)
async def summarize(payload: SummarizeRequest):
    if not payload.text or len(payload.text.strip()) < 20:
        raise HTTPException(422, "'text' is too short to summarize.")
    try:
        return run_summarize(payload.solution_id, payload.text, payload.max_sentences)
    except Exception as e:
        logger.exception("summarize pipeline failed")
        raise HTTPException(500, f"Summarization pipeline error: {e}")


@app.post("/rank", response_model=RankResponse)
async def rank(payload: RankRequest):
    problem = payload.problem.model_dump()
    candidates = [c.model_dump() for c in payload.candidates]
    if not candidates:
        raise HTTPException(400, "At least one candidate solution is required.")

    try:
        results = run_rank(problem, candidates)
    except Exception as e:
        logger.exception("rank pipeline failed, falling back to TF-IDF")
        try:
            results = rank_fallback_tfidf(problem, candidates)
        except Exception as e2:
            raise HTTPException(500, f"Ranking failed (embedding error: {e}; fallback error: {e2})")

    return {"problem_id": problem["id"], "results": results}
