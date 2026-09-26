# ML Service API

The ML service runs as a FastAPI microservice on port `:8001` (ASSUMED based on `main.py` comments referencing `:8001`). 
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
