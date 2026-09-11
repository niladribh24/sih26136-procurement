# SIH26136 — Full Project Breakdown

## 1. The problem, restated simply

Government departments have operational problems that startups could solve,
but normal government buying process is built for big, established vendors —
not small unproven startups. The brief asks for a system that takes a startup
from "government notices they exist" all the way through a small test run to
an actual purchase, and then lets other departments reuse what worked.

Four stages, always in this order:

```
IDENTIFY  →  PILOT  →  PROCURE  →  SCALE
```

- **Identify** — government posts what they need, startups respond with a solution
- **Pilot** — the shortlisted startup runs a small, time-boxed test before a full contract
- **Procure** — a successful pilot gets converted into an actual (simulated) purchase
- **Scale** — other departments can adopt an already-proven solution without re-testing it

Everything below is organized by who builds what: **Frontend**, **Backend**, **NLP**.

---

## 2. System overview

```
┌─────────────┐      REST       ┌─────────────┐     internal call    ┌─────────────┐
│  FRONTEND   │ ───────────────▶│   BACKEND   │ ─────────────────────▶│  NLP SERVICE │
│  (React)    │◀─────────────── │ (FastAPI +  │◀───────────────────── │  (Python)    │
│             │   JSON data     │  Postgres)  │     tags/scores       │              │
└─────────────┘                 └─────────────┘                       └─────────────┘
```

- Frontend never talks to the NLP service directly — it only talks to the backend.
- The backend is the only thing that writes to the database.
- The NLP service is stateless — it takes text in, returns structured data out, remembers nothing.

Two user types log in: **Startups** and **Government Officers**. Each has their
own dashboard with different screens.

---

## 3. FRONTEND — what gets built, screen by screen

**Two dashboards, one app.** After login, route by role.

### 3.1 Shared / auth
- **Signup page** — role toggle (Startup / Govt Officer), org name, email, password
- **Login page**

### 3.2 Startup dashboard
- **Profile page** — description, DPIIT number, turnover band. Upload past project PDFs. Once uploaded, shows the auto-extracted tags/skills back to the startup (e.g. "AgriTech · computer vision · IoT sensors") with an option to correct a wrong tag.
- **Problem browser** — list of open problem statements from all departments, filterable by domain.
- **Solution submission page** — pick a problem, write an abstract, upload a solution PDF.
- **My pilots** — list of pilots this startup is currently in, with milestone status.

### 3.3 Government dashboard
- **Post a problem** — structured form: title, domain, description, desired outcome, budget band, TRL expected.
- **My problems / forum view** — list of problems this officer has posted, with submission counts.
- **Ranked shortlist page** — for one problem, shows all submitted solutions sorted by match score, with the AI-generated summary and the highlighted phrases that drove the ranking. This is the main "wow" screen — make it visually clear *why* something ranked high.
- **Eligibility + evaluation panel** — checklist (auto-filled where possible) + a scoring rubric an evaluator fills manually.
- **Pilot tracker** — create a pilot from a shortlisted solution, set milestones, click through status (Proposed → Active → Completed).
- **Procurement view** — button to generate a procurement package from a completed pilot; shows the compliance checklist.
- **Proven solutions / scale page** — browse other departments' completed procurements, request to replicate one.

### 3.4 Frontend build notes
- Keep forms controlled components, validate required fields client-side before hitting the backend.
- The ranked shortlist and pilot tracker are your two most important screens for the demo video — spend the most polish time there.
- Everything else (eligibility, evaluation, procurement, scale) can be simpler UI as long as it's wired to real backend calls, not hardcoded.

---

## 4. BACKEND — what gets built, endpoint by endpoint

**Stack:** FastAPI (or Node/Express) + PostgreSQL. Schema already defined in `schema.sql`.

### 4.1 Responsibilities
1. Auth — signup/login, issue JWT, role-based access (startup / govt_officer / admin / evaluator)
2. CRUD for every entity — profiles, problems, solutions, pilots, milestones, evaluations, agreements, procurement records
3. Call the NLP service when a PDF is uploaded or a solution needs ranking, and store what comes back
4. Enforce business rules the frontend shouldn't be trusted to enforce alone:
   - Eligibility = simple boolean checks (turnover under limit? DPIIT verified? domain matches?)
   - Pilot status can only move along the allowed state machine (Proposed → Under review → Approved → Active → Completed/Failed → Recommended for procurement) — reject invalid jumps
   - A pilot can't be validated by the same person who evaluated its original solution

### 4.2 Core endpoint groups
- `/api/auth/*` — signup, login
- `/api/startups/*` — profile CRUD, document upload (triggers NLP `/extract`)
- `/api/problems/*` — problem CRUD, list/filter
- `/api/problems/:id/solutions` — submit solution (triggers NLP `/summarize` + `/rank`), get ranked list
- `/api/solutions/:id/eligibility` — eligibility check CRUD
- `/api/solutions/:id/evaluations` — evaluator scoring
- `/api/pilots/*` — pilot CRUD, status transitions, milestones
- `/api/milestones/:id` — update status, attach payment tranche
- `/api/pilots/:id/ip-agreement` — IP/data clause CRUD
- `/api/pilots/:id/kpi` — KPI logging
- `/api/pilots/:id/validate` — independent validation record
- `/api/pilots/:id/procure` — generate procurement package from stored pilot data
- `/api/proven-solutions/*` — browse + replication requests

### 4.3 Backend build notes
- Build auth + one real CRUD endpoint first (e.g. problems) so frontend has something real to connect to on day 1.
- Business logic here should be simple rule-based checks, not "smart" — the intelligence lives in the NLP service, not here.
- Every endpoint that returns data the NLP service produced should just be reading it back out of the DB — the backend doesn't call the NLP service live on every page load, only when new content is submitted.

---

## 5. NLP SERVICE — what gets built, pipeline by pipeline

**Stack:** Python, standalone FastAPI microservice, no database of its own.

### 5.1 Pipeline 1 — Startup tagging (`/extract`)
Runs when a startup uploads a project document.
1. Extract text from the PDF (PyMuPDF/pdfplumber; Tesseract OCR as fallback for scanned PDFs)
2. Generate an embedding of the text (sentence-transformers, `all-MiniLM-L6-v2`)
3. Zero-shot classify against a fixed domain list (AgriTech, HealthTech, GovTech, CleanTech, FinTech, EdTech...) using a model like BART-MNLI
4. Extract specific skills/technologies mentioned (spaCy NER + KeyBERT keyword extraction, cross-checked against each other)
5. Return: `{ tags: [...], skills: [...], embedding: [...] }`

### 5.2 Pipeline 2 — Solution summarization (`/summarize`)
Runs when a startup submits a solution PDF against a problem.
1. Extract text from the solution PDF
2. Summarize into 2-4 sentences so an officer doesn't need to read the full document
3. Return: `{ summary: "..." }`

### 5.3 Pipeline 3 — Ranking (`/rank`)
Runs once a problem has one or more submitted solutions.
1. Embed the problem statement text
2. Embed each solution's text
3. Compute cosine similarity between problem and each solution (FAISS or pgvector-side comparison)
4. Identify which phrases contributed most to the match (simple keyword-overlap highlighting is enough — you don't need attention-weight extraction for a hackathon demo)
5. Return: `{ results: [{ solution_id, match_score, match_explain }] }`

### 5.4 NLP build notes
- Build and test this service completely independently first, using sample PDFs and text files — don't wait on the backend to exist.
- Get tagging (`/extract`) working end-to-end on day 1; it's your single strongest demo moment.
- Keep the explainability output simple — a list of matched phrases with weights is enough, don't over-engineer it.
- Use your own small labeled set (~100 manually tagged startup descriptions) to sanity-check the zero-shot classifier isn't producing nonsense before demo day.

---

## 6. How a single user action flows through all three services

**Example: a startup submits a solution to a problem.**

1. **Frontend** — startup fills the solution form, uploads a PDF, hits submit
2. **Backend** — receives the request, saves the file, extracts text, calls **NLP** `/summarize` and `/rank`
3. **NLP** — returns a summary and a match score + explanation
4. **Backend** — stores all of it in `solution_abstracts`, returns success to frontend
5. **Frontend** — on the officer's side, the ranked shortlist page calls the backend, which just reads the already-computed scores back out of the DB — no live NLP call on page load

This same pattern (frontend submits → backend saves + optionally calls NLP → backend stores result → frontend reads it back later) applies everywhere. The NLP service is only ever called at the moment new content is created, never on every page view.

---

## 7. What's "real" vs "simple logic" (not fake, just not deep)

| Stage | What's real | What's rule-based, not AI |
|---|---|---|
| Identify | Real NLP tagging + ranking | — |
| Eligibility | — | Boolean checks against DB fields |
| Evaluation | Real form, real stored scores | Rubric math is a simple sum, not ML |
| Pilot | Real state machine, real milestone rows | State transitions are fixed rules |
| IP/Data | Real form, real stored clauses | Template selection, not generated text |
| Procurement | Real package generated from real DB data | Template fill, not a real GeM integration (not possible to access) |
| Scale | Real DB query + real replication request rows | — |

Nothing here is hardcoded demo data — every screen reflects something actually
saved in Postgres. The only simplification is that some logic is straightforward
rules instead of machine learning, which is a reasonable and expected scope cut
for a 2-3 day build.
