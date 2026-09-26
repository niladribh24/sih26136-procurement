# ML Service API

The ML service (`nlp/`) runs as a FastAPI microservice on port `:8001` (`uvicorn app.main:app --port 8001`).
Shapes below are copied from `nlp/app/schemas.py`, which is the source of truth; the backend
validates every response against its own copy in `backend/app/schemas/ml.py`.

## How the backend calls it
All calls go through `backend/app/services/ml_client.py` (httpx, 2 s connect timeout,
`ML_TIMEOUT_SECONDS` read timeout, default 60). Any failure (down, timeout, non-2xx, or a
response that doesn't validate) becomes `MLUnavailable`, and the data is left pending for
`python retry_ml.py`. Full responses are stored verbatim in JSONB.

| Endpoint | Called when | Backend sends | Stored in |
|---|---|---|---|
| `/extract` | startup uploads a document | the saved PDF as `file`, plus `target_domains` = the six frontend domains | `startup_documents.extract_result`; union of tags/skills + best domain on `startup_profiles` |
| `/summarize` | solution submitted | PDF text via pypdf (abstract if < 200 chars), capped at 15k chars | `solution_abstracts.summary_result`, `ai_summary` |
| `/rank` | officer/evaluator lists a problem's solutions and any are unranked, or `POST .../solutions/rank` | the problem + **all** its solutions in one call | `solution_abstracts.rank_result`, `match_score` |

It provides the following endpoints:

## 1. POST `/extract`
Extracts text from a PDF and runs entity recognition / summarization.
- **Content-Type**: `multipart/form-data`
- **Request parameters**:
  - `file`: (Optional) PDF `UploadFile`
  - `text`: (Optional) String form data containing text. Either `file` or `text` is required.
  - `target_domains`: (Optional) Comma-separated string of target domains.
- **Response JSON**:
  ```json
  {
    "domain": "string",
    "confidence": 0.0,
    "tags": ["string"],
    "skills": ["string"],
    "summary": "string",
    "extracted_trl_estimate": "string",
    "ocr_performed": boolean
  }
  ```

## 2. POST `/summarize`
Generates a summary of text for a specific solution.
- **Content-Type**: `application/json`
- **Request JSON**:
  ```json
  {
    "solution_id": "string",
    "text": "string",
    "max_sentences": 3
  }
  ```
- **Response JSON**:
  ```json
  {
    "solution_id": "string",
    "summary": "string",
    "technical_claims": ["string"],
    "cost_timeline_summary": "string"
  }
  ```

## 3. POST `/rank`
Ranks candidate solutions against a problem statement.
- **Content-Type**: `application/json`
- **Request JSON**:
  ```json
  {
    "problem": {
      "id": "string",
      "title": "string",
      "description": "string",
      "desired_outcome": "string",
      "domain": "string", // optional
      "target_trl": "string" // optional
    },
    "candidates": [
      {
        "solution_id": "string",
        "title": "string",
        "abstract": "string",
        "claimed_trl": "string" // optional
      }
    ]
  }
  ```
- **Response JSON**:
  ```json
  {
    "problem_id": "string",
    "results": [
      {
        "solution_id": "string",
        "match_score": 0.0,
        "match_percent": 0,
        "rank": 0,
        "match_explanation": "string",
        "matched_keywords": ["string"],
        "semantic_breakdown": {
          "problem_relevance": 0.0,
          "technical_feasibility": 0.0,
          "operational_alignment": 0.0
        }
      }
    ]
  }
  ```
