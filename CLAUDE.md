# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SAMARTH (Smart India Hackathon 2026, Problem Statement `SIH26136`): a public-procurement lifecycle platform bridging DPIIT startups and government departments through four stages — **Identify → Pilot → Procure → Scale** — under GFR Rule 194. See root `README.md` for the full architecture diagrams and RBAC matrix.

The repo is split into three independently-owned services that were built in parallel against a locked contract:

```
frontend/   Next.js 16 web app
backend/    FastAPI skeleton (config, DB, ORM models, /health) + schema.sql + docs — no domain endpoints yet
nlp/        FastAPI microservice (Python) — extract/summarize/rank pipelines
docs/       Cross-cutting specs (NLP requirements, frontend API contract, demo runbook)
```

**Current reality check:** the frontend has no real backend to call. `frontend/lib/api.ts` is a complete mock implementation that persists everything to `localStorage` and simulates NLP results (fixed match score, canned tags/summary). There isn't a real `fetch`/`axios` call to a backend anywhere in the frontend. Don't assume backend or NLP endpoints are reachable — check `frontend/lib/api.ts` before wiring up "real" calls, and treat `backend/docs/api_contract.md` as the target shape, not a live API.

## Backend developer working agreement (read this first)

This repo has three owners working in parallel. **You (the human operator) are the backend + database developer.** Claude's scope on this project is:

- **Only ever create or edit files inside `backend/`.** Never edit anything under `frontend/` or `nlp/` unless the user explicitly asks in that specific message — reading those directories for context (contracts, types) is fine and expected, writing to them is not.
- **Never change the wire contract or the schema on your own initiative.** `backend/docs/api_contract.md`, `backend/schema.sql`, and the shapes implied by `frontend/lib/types.ts` / `frontend/lib/api.ts` are the agreement between three people who built independently. If implementing a feature seems to require a different field, a renamed column, or a new endpoint shape than what's documented, **stop and ask the user first** — don't silently add a column, rename a field, or invent a response shape, even to fix an obvious-looking bug. Point out the mismatch and propose the change; let the user decide and (if it's a contract change) relay it to teammates.
- The user is new to databases — prefer explaining *why* a schema/query decision is being made, not just making it, and flag anything that's a common beginner foot-gun (e.g. cascading deletes, missing indexes on foreign keys, N+1 queries) as you go.

### Source-of-truth rule for resolving contract/schema mismatches
When `schema.sql`, the docs, and the actual frontend/nlp code disagree (they do, in several places — see the change log below), resolve in this order:
1. **`frontend/lib/types.ts`** is the source of truth for API **response shapes** the backend must produce — the frontend team isn't going to reshape their components around the backend.
2. **The actual code in `nlp/app/schemas.py`** (not any doc, not the original hand-written contract) is the source of truth for what the ML service really returns.
3. **`backend/schema.sql` adapts to fit both of the above** — it's the one piece with no other consumer depending on its current shape.
This is a standing rule for future mismatches too, not just the ones already resolved — when you hit a new one, apply this ordering, propose the concrete change, and still confirm with the user before writing it (per the rule above).

### Contract & schema change log (v2 — applied, don't re-litigate)
These decisions were made explicitly by the user and applied to `backend/schema.sql` and `backend/docs/api_contract.md`; treat them as settled, not as open questions:
1. Dropped the `pgvector` extension and all `VECTOR(384)` columns (`startup_profiles.embedding`, `problems.embedding`) — replaced with nullable `REAL[]`, since pgvector is hard to install on Windows and the ML service's `/rank` already does its own similarity scoring server-side and never actually returns an embedding to the backend.
2. `solution_abstracts` stores `match_score NUMERIC` plus the **entire** `/rank` `RankResult` object for that solution in a `rank_result JSONB` column (replacing the old `match_explain` column, which assumed a shape ML never actually returns). The API layer maps `rank_result` onto the frontend's `matchScore` / `matchExplanation` / `matchedKeywords` fields.
3. `evaluations` rubric fields are `technical_merit`(/30), `cost_realism`(/20), `team_capability`(/20), `timeline_viability`(/30) — replacing the old `innovation_score`/`feasibility_score`/`impact_score`, which had no frontend equivalent at all.
4. `pilot_milestones.status` is now an enum `pending | submitted | verified | failed` (was free-text `pending/done/missed`), matching `frontend/lib/types.ts` `Milestone.status` exactly.
5. `payment_tranches` table is gone. Tranche amount, percentage, disbursed flag, and disbursed timestamp are now columns directly on `pilot_milestones`, matching the frontend's flat `Milestone` shape (it has no separate Payment/Tranche object).
6. `POST /api/auth/signup` and `POST /api/auth/login` now return the **full** `UserSession` shape from `frontend/lib/types.ts`, not just `{user_id, token}` — `users` gained `name`, `department`, `avatar_url` columns to support this.
7. Build priority: everything `frontend/lib/api.ts` calls, first — including the eligibility rule engine, which must run automatically on solution submission (not built as a separate manual step). `ip_agreements`, `kpi_logs`, `validations`, and `procurement_records` keep their tables but get no endpoints yet.
8. `replication_requests` extended with `pilot_id`, `requesting_officer_name`, `requesting_officer_email`, `target_deployment_site`, `target_quantity`, `target_budget`, `deployment_timeline_weeks`, and its `status` enum changed to `pending | approved | in_pilot` (was `requested/approved/rejected`). It stays normalized, not denormalized: `solutionTitle`/`startupName`/`originatingDepartment`/`requestingDepartment` in `frontend/lib/types.ts` `ReplicationRequest` are filled in by the API via joins at read time (`proven_solution_id` → `procurement_records` → `pilots` → `problems`/`solution_abstracts`/`startup_profiles`; `requesting_dept_id` → `users.org_name`) rather than stored as copies on the row.

9. `replication_requests.status` is `NOT NULL` with a named CHECK constraint (`replication_requests_status_check`) restricting it to `pending | approved | in_pilot`.

One knock-on rename made *because of* #4, not an independent decision: `pilots.missed_milestones_count` was renamed to `failed_milestones_count`, since "missed" is no longer a valid milestone status — flagged here in case that's not wanted.

Two known gaps this round did **not** touch (raised earlier, not yet decided):
- `nlp/app/schemas.py`'s `/extract` returns flat `tags: List[str]` / `skills: List[str]` plus `domain`/`confidence`/`summary`/`extracted_trl_estimate`/`ocr_performed`; `startup_profiles.extracted_tags`/`extracted_skills` still assume the old `[{domain/skill, confidence}]` object-array shape.
- `frontend/lib/api.ts`'s `logAuditEntry()` has no backing table in `schema.sql` at all.

### Stack
- **Framework:** FastAPI
- **Database:** PostgreSQL — database `sih_db`, user `postgres`, `localhost:5432` (local dev, Windows machine)
- **ORM:** SQLAlchemy
- **Auth:** JWT
- **Outbound calls:** `httpx` for the backend → ML service calls (never the reverse, never frontend → ML directly)

### `backend/` folder structure
The skeleton exists (config, database, models, `/health`, `init_db.py`, drift test). `schemas/`, `routers/`, `services/`, `auth/` are still planned — created as endpoints get built. Models only map onto tables `schema.sql` creates; never call `Base.metadata.create_all()`.

```
backend/
├── schema.sql                # schema — don't edit without asking; see v2 change log above
├── docs/
│   ├── api_contract.md        # canonical API contract — don't edit without asking
│   └── ml_service.md          # ML service shapes, kept in sync with nlp/app/schemas.py
├── requirements.txt
├── init_db.py                # applies schema.sql via psycopg (psql isn't on PATH); --reset wipes + rebuilds
├── .env.example              # DATABASE_URL, JWT_SECRET, ML_SERVICE_URL, FRONTEND_URL — never commit a real .env
├── app/
│   ├── main.py                # FastAPI app instance, router registration, CORS
│   ├── config.py               # settings loaded from env (pydantic-settings)
│   ├── database.py             # SQLAlchemy engine/session, get_db dependency
│   ├── models/                 # SQLAlchemy ORM models — one module per schema.sql table group
│   │   ├── user.py
│   │   ├── startup.py          # startup_profiles, startup_documents
│   │   ├── problem.py          # problems, solution_abstracts
│   │   ├── evaluation.py       # eligibility_checks, evaluations
│   │   ├── pilot.py            # pilots, pilot_milestones (tranche fields inline — no payment_tranches table)
│   │   ├── agreement.py        # ip_agreements, kpi_logs, validations
│   │   └── procurement.py      # procurement_records, proven_solutions, replication_requests
│   ├── schemas/                 # Pydantic request/response models — mirrors frontend/lib/types.ts shapes
│   ├── routers/                  # one router per docs/api_contract.md section (auth, startups, problems, pilots, ...)
│   ├── services/
│   │   ├── ml_client.py          # httpx wrapper for nlp /extract, /summarize, /rank
│   │   ├── eligibility.py        # rule engine — runs automatically on solution submission, build early
│   │   └── pilot_state_machine.py # enforces the pilot status transitions server-side
│   └── auth/                     # password hashing, JWT issue/verify, role-based dependencies
└── tests/
    └── test_models_match_schema.py  # reflects the live DB and fails if models drift from schema.sql
```

Migrations: given the schema is "locked" and this is a short hackathon build, we're applying `schema.sql` directly via `init_db.py` rather than introducing Alembic — revisit only if the user asks for migration history.

## Commands

### Frontend (`frontend/`) — the only service with a working dev loop
```bash
cd frontend
npm install
npm run dev      # Turbopack dev server, http://localhost:3000
npm run build    # production build (target: <500ms, zero TS/lint errors across all routes)
npm run start    # serve the production build
npm run lint     # eslint (flat config, eslint-config-next core-web-vitals + typescript)
```
There is no test runner configured in this repo (no test files, no test script in `package.json`).

### NLP microservice (`nlp/`)
```bash
cd nlp
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload   # drop --reload for demo runs
curl http://localhost:8001/healthz
```
First run downloads `all-MiniLM-L6-v2` and `facebook/bart-large-mnli` from Hugging Face — do this once with internet before going offline. `nlp/sample_rank_request.json` gives a ready-made `/rank` payload for manual curl testing (examples in `nlp/README.md`).

### Backend (`backend/`)
`backend/schema.sql` is the Postgres schema (no pgvector — dropped in v2, see change log above); extend it in place (add columns there first, per its own header comment), then update the matching model in `app/models/`. Database is `sih_db` on `localhost:5432`, user `postgres`. `psql` is not on the user's PATH — use `init_db.py`. Python venv is 3.14 (the `py` launcher lists a 3.13 whose executable is missing).
```powershell
cd backend
py -3.14 -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env        # fill in postgres password
python init_db.py                  # create sih_db if missing + apply schema (no-op if already applied)
python init_db.py --reset          # DEV ONLY: drop everything and re-apply
pytest                             # model/schema drift test + replication status CHECK test
uvicorn app.main:app --reload --port 8000   # GET /health checks DB connectivity
```

## Architecture notes that span files

### Three-tier contract, strictly one-directional
Frontend → Backend → {Postgres, NLP microservice}. The frontend must never call the NLP service or Postgres directly; the NLP service must never touch Postgres. This boundary is documented in `backend/docs/api_contract.md` and the root `README.md` §2 — preserve it even though today the frontend is mocked and bypasses the backend entirely.

### The pilot state machine is the backbone of the domain model
```
proposed -> under_review -> approved -> active -> completed -> recommended_for_procurement
                                            |
                                            -> failed
```
This exact transition set appears in three independent places that must stay in sync: `backend/schema.sql` (`pilot_status` enum), `backend/docs/api_contract.md` §3, and `frontend/lib/types.ts` (`PilotStatus`, which also adds a terminal `"Procured"`). No other transitions are valid — server-side (when a real backend exists) and client-side both must reject illegal jumps. Milestone status (`pending/submitted/verified/failed`, on `pilot_milestones.status`) is a separate, unrelated state machine — don't conflate the two.

### NLP contract shapes: `nlp/` code is authoritative, docs follow it
`nlp/app/schemas.py` is described in its own docstring as "locked to `docs/NLP_UI_REQUIREMENTS.md` in the main repo — do not rename fields without updating the backend client too," but per the source-of-truth rule above, treat the actual code as ground truth over that doc if they ever disagree. `backend/docs/ml_service.md` is kept in sync with `nlp/app/schemas.py` for this reason. The three pipelines (`/extract`, `/summarize`, `/rank`) each have a fixed shape; `frontend/lib/api.ts::extractDocumentTags` and `submitSolution` mock the results these endpoints will eventually produce. If you change a field name in `nlp/app/schemas.py`, update `backend/docs/ml_service.md`, `backend/docs/api_contract.md`, and `schema.sql`/frontend types together.

### `backend/docs/` is now the canonical contract location
`backend/docs/api_contract.md` is the single, current API contract — it merges and replaces both the original hand-written `backend/API_CONTRACT.md` (deleted) and an earlier reverse-engineered draft that used to live at this same path. `backend/docs/ml_service.md` is likewise authoritative for ML shapes (verified against `nlp/app/schemas.py`, not guessed). `backend/schema.sql` is the only schema file (a stale pre-v2 duplicate at `backend/docs/schema.sql` was deleted).

### Frontend session & routing model
- `frontend/lib/auth.ts` stores the session in both `localStorage` and a `samarth_session_role` cookie (dual-layer so Edge middleware can read role without hydration). Role changes broadcast via a `samarth_auth_change` window event; `useSyncExternalStore` consumers (e.g. the top header) subscribe via `subscribeSession`.
- `frontend/proxy.ts` (Next.js Edge middleware, matcher `/startup/*` and `/gov/*`) gates routes purely on that cookie: `startup` role for `/startup/*`, one of `govt_officer`/`evaluator`/`admin` for `/gov/*`. There's no server-verified auth — it's a cookie-presence check for demo purposes.
- Four roles throughout (`startup`, `govt_officer`, `evaluator`, `admin`) map to two dashboard trees (`app/(dashboard)/startup/*`, `app/(dashboard)/gov/*`); `evaluator` and `admin` share the gov tree with `govt_officer`. See root `README.md` §4 for the full RBAC capability matrix — a govt officer and an independent evaluator must remain separable in the UI (conflict-of-interest requirement: the pilot validator must differ from the proposal evaluator).

### Frontend design system is a hard constraint, not a suggestion
`frontend/DESIGN.md` is the frontend's own design constitution ("every AI coding agent... MUST read this file before creating or modifying UI") and is large enough that it isn't duplicated here — read it before touching any component in `frontend/components/` or `frontend/app/`. Key non-negotiables it establishes:
- **Civic Editorial** visual language: warm parchment canvas, sovereign navy primary actions, warm ochre for AI/match-score elements — never purple gradients, neon/glassmorphism, emoji, or generic "AI-powered" template tropes (full prohibition list in DESIGN.md §02/§06).
- Typography is load-bearing: `IBM Plex Sans` (UI), `Newsreader` (editorial titles/dockets), `IBM Plex Mono` (IDs, DPIIT numbers, currency, timestamps, scores) — not interchangeable.
- Component structure is prescribed: `components/ui` (primitives), `components/layout` (shell), `components/domain` (civic workflow components), each with fixed responsibilities listed in DESIGN.md §29.
- There's an explicit "Anti-Slop Review" checklist (DESIGN.md §31) to run before considering any frontend change complete.
- `frontend/AGENTS.md` is auto-regenerated by `next dev` on every run (see its own header) — don't hand-edit it; it just points at `node_modules/next/dist/docs/` for this Next.js version's breaking-change notes relative to training data.

### Data model cross-reference
`backend/schema.sql` and `frontend/lib/types.ts` model the same ten-module domain (startup profiles, problems, solution abstracts, eligibility, evaluations, pilots/milestones w/ inline tranches, IP agreements, KPI/validation, procurement records, proven-solutions/replication) with different casing conventions (snake_case SQL vs. camelCase TS). As of the v2 change log above, the rubric fields, milestone status enum, tranche placement, and replication-request fields were brought into alignment with the frontend types deliberately — the remaining shape difference is that the frontend's `Solution`/`Pilot` types embed things directly (`rubricScore`, `milestones[]`) that the SQL keeps as separate/nested (`evaluations` table, `pilot_milestones` rows) — that's expected, the API layer does the flattening. When adding a new field, decide deliberately whether it belongs in both, and update `backend/docs/api_contract.md` if the wire shape changes.
