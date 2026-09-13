# SAMARTH NLP Microservice (Role 3)

Stateless FastAPI service implementing the three pipelines from
`docs/NLP_UI_REQUIREMENTS.md`: `/extract`, `/summarize`, `/rank`.
No database — it never talks to Postgres, only to the backend that calls it.

## 1. Setup (run once, ideally on the A100 box)

```bash
cd nlp
python -m venv .venv && source .venv/bin/activate      # or conda
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# Tesseract is a system binary, not a pip package — needed for the OCR fallback:
sudo apt-get install -y tesseract-ocr
```

First run downloads `all-MiniLM-L6-v2` (~90MB) and `facebook/bart-large-mnli`
(~1.6GB) from Hugging Face — do this once with internet access before you're
offline in a demo room.

## 2. Run it

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

`--reload` is for local dev only — drop it for the actual demo run so
model preloading at startup isn't disturbed by file-watcher restarts.

Check it's alive:
```bash
curl http://localhost:8001/healthz
```

`torch.cuda.is_available()` is checked automatically for the zero-shot
classifier (`models.py::get_zero_shot`) — on the A100 box this puts
BART-MNLI on GPU with no extra flags. `sentence-transformers` also picks up
CUDA automatically if it's on the same machine.

## 3. Day-1 priority (per the build notes)

Build/test in this order — each pipeline is independently testable with
plain text, no PDF or backend needed:

1. **`/extract`** — your strongest demo moment, get this solid first.
2. **`/rank`** — the "wow" screen on the frontend depends on this.
3. **`/summarize`** — simplest of the three, do it last.

### Quick manual test (no PDF required)

```bash
# /extract with raw text instead of a file
curl -X POST http://localhost:8001/extract \
  -F "text=Our platform uses a Jetson Orin Nano edge computer running YOLOv8 for real-time thermal segmentation of canal seepage, with RTK-GNSS positioning and TRL-6 field validation across 500 hectares in Punjab."

# /summarize
curl -X POST http://localhost:8001/summarize \
  -H "Content-Type: application/json" \
  -d '{"solution_id":"sol-001","text":"Dual-sensor SWIR UAV platform with onboard Jetson Orin Nano edge inference delivering sub-5cm mapping at 45ms latency. Deployed across 500 hectares in Punjab over 3 phased milestones costing Rs 28,50,000 across 16 weeks.","max_sentences":2}'

# /rank — same shape the backend will send
curl -X POST http://localhost:8001/rank \
  -H "Content-Type: application/json" \
  -d @sample_rank_request.json
```

`sample_rank_request.json` (the exact example from the spec) is included
in this folder so you can copy-paste this immediately.

### Sanity-checking the classifier before demo day

Per the build notes: hand-label ~100 short startup descriptions against
the 6 domains (`AgriTech`, `GovTech`, `Defence`, `HealthTech`, `CleanTech`,
`DroneTech`) and run them through `/extract` in a loop, comparing
`domain`/`confidence` against your labels — catches an obviously-wrong
zero-shot classifier before a judge sees it.

## 4. What's implemented vs. simplified (be ready to say this out loud)

| Piece | Approach | Why |
|---|---|---|
| Domain classification | Zero-shot (`facebook/bart-large-mnli`) against the 6 fixed domains | Matches spec exactly, no training data needed |
| Tags vs. skills split | KeyBERT keyphrases, bucketed by a proper-noun/acronym/version-number heuristic | "Skills" (YOLOv8, ROS2) vs. "tags" (Edge Compute) is a soft distinction — a pattern rule is enough for a hackathon judge, no need to train a classifier for it |
| `/extract` and `/summarize` summaries | Extractive (centroid-similarity sentence selection), not generative | Deterministic, no hallucinated numbers, comfortably inside the latency SLA |
| `/rank` match score | Weighted cosine similarity across 3 sub-scores + a TRL-distance bonus | Gives you the `semantic_breakdown` the shortlist UI wants without a trained ranker |
| Matched keywords | KeyBERT phrases from problem + candidate, paired by embedding similarity | "Simple keyword-overlap highlighting", exactly what the build notes ask for — not attention-weight extraction |
| TF-IDF fallback | `pipeline_rank.rank_fallback_tfidf` | Only path that doesn't need the embedding model loaded — wire it into the backend's timeout/retry logic per the SLA table |

## 5. Files

```
nlp/
├── app/
│   ├── main.py              # FastAPI routes: /extract /summarize /rank /healthz
│   ├── models.py             # lazy-loaded singletons for every ML model
│   ├── pdf_extract.py         # PDF text extraction + Tesseract OCR fallback
│   ├── pipeline_extract.py    # Pipeline 1
│   ├── pipeline_summarize.py  # Pipeline 2
│   ├── pipeline_rank.py       # Pipeline 3 + TF-IDF fallback
│   └── schemas.py             # request/response models, locked to the API contract
├── requirements.txt
└── sample_rank_request.json
```

## 6. Talking to the backend

Base URL for local dev: `http://localhost:8001`. The backend teammate
should point their internal HTTP client here (`NLP_SERVICE_URL` env var
on their end, not yours) — you don't need to touch their code, just keep
this service's request/response shapes exactly as documented in
`docs/NLP_UI_REQUIREMENTS.md`, since `schemas.py` is a direct copy of
those shapes.
