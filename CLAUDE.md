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

10. Auth (built): `POST /api/auth/signup` takes **camelCase** input `{ role, name, orgName, email, password, department?, dpiitNumber? }` (was snake_case `org_name`). Startups must give `dpiitNumber` at signup (frontend regex `^(DIPP|DPIIT)\d{5}$`), and signup creates their `startup_profiles` row right away (was: null until the profile was filled in). `govt_officer`/`evaluator` must give `department`. `admin` can't self-register (422). Added `GET /api/auth/me`, which returns `UserSession`. Error codes: 401 bad/missing/expired token or bad credentials, 403 wrong role, 409 duplicate email, 422 validation. Use `app.auth.get_current_user` / `require_role(...)` to protect new endpoints.

11. `startup_profiles.user_id` is now `UNIQUE`: one profile per user, and the constraint's index serves the `user_id` lookup. The drift test now also compares UNIQUE constraints between the models and the DB.

12. `problems` gained `code` (UNIQUE, filled by a DB default from the `problem_code_seq` sequence → `PRB-2026-001`), `department`, `ministry` (stored per problem, since the create form lets the officer edit them), and `deadline DATE`. The `problem_status` enum is now `open | evaluating | pilot_active | completed`, matching `Problem.status` (it was `open/under_review/closed`). `trl_expected` stays an INT, and the API maps it to and from `"TRL-6"`. `submissionCount` is counted at read time, not stored. Added an index on `problems(posted_by)`.

13. `solution_abstracts` gained `title`, `claimed_trl INT`, `proposed_cost NUMERIC`, `proposed_duration_weeks INT`, and `status` (new `solution_status` enum `submitted | under_review | shortlisted | rejected`), plus `UNIQUE (problem_id, startup_id)`: one proposal per startup per problem, 409 on a second one. That constraint's index replaced the standalone `solution_abstracts(problem_id)` index. `startup_profiles` gained `location` and `incorporation_year`, and `startup_documents` gained `original_filename`, which is for display only. The drift test now also compares multi-column UNIQUE constraints.

14. Startup profile, document, problem, and solution endpoints are built; see `backend/docs/api_contract.md` for URLs. Decisions made there:
    - `Solution.startupId` is the startup's **user id**, because the frontend compares it to `session.id`.
    - A startup only ever sees its own solutions. Anyone else's returns 404, not 403.
    - Only a `govt_officer` creates problems, and only the officer who posted a problem can edit it.
    - A solution's status can be changed by the officer who posted its problem or by any evaluator. Admins can't.
    - Uploaded PDFs go to `backend/uploads/` (the `UPLOAD_DIR` setting) under random names. A file only counts as a PDF if it starts with the `%PDF-` bytes (otherwise 415), and the limit is 10 MB (413).
    - Rubric writing (`updateSolutionRubric`) is deferred to a later phase; the eligibility engine is #16. (ML fields were left pending in this round; #15 fills them.)

15. The ML service is integrated (`services/ml_client.py`, `services/ml_sync.py`; see `backend/docs/ml_service.md`).
    - **Schema:**
      - `startup_documents.extract_result JSONB` and `solution_abstracts.summary_result JSONB` hold the full `/extract` and `/summarize` responses, the same way `rank_result` holds `/rank`'s.
      - `startup_profiles.domain TEXT` holds the most confident `/extract` domain.
      - `extracted_tags`/`extracted_skills` are now flat string arrays (the deduplicated union across the startup's documents). This closes the old tags-shape gap.
    - **When each pipeline runs:**
      - `/extract` receives the PDF itself on document upload.
      - `/summarize` runs on solution submission. Its input is the PDF text read with `pypdf` (a new dependency), or the abstract if the PDF has under 200 characters of text. The summary is stored only, not exposed, because `Solution` has no field for it.
      - `/rank` scores all of a problem's solutions in one call. It runs automatically when a government role lists the problem's solutions and any are unranked, or on demand via `POST /api/problems/:id/solutions/rank` (the owning officer or any evaluator; 503 if ML is down).
    - **Failure handling:** ML failures never fail a request. Rows are committed first, then ML runs, and anything missing stays pending (NULL). An unranked solution's `matchExplanation` reads `"AI match analysis pending."` Run `python retry_ml.py` to fill in everything pending.
    - **Tests:** an autouse `FakeML` fixture (down by default) sits behind `httpx.MockTransport`, so pytest never contacts a real ML service. `tests/test_ml_live.py` runs only with `RUN_LIVE_ML=1`.

16. The eligibility rule engine is built (`app/services/eligibility.py`; endpoints in `backend/docs/api_contract.md`).
    - **Schema:** `eligibility_checks.rule_results JSONB` holds `[{rule, status, reason}]` for every rule. The four `*_ok` booleans mean TRUE = pass, FALSE = fail, NULL = pending. `overall_eligible`'s three-valued AND already gives FALSE on any fail and NULL while something is pending. There's one row per solution, updated in place on a re-run.
    - **Rules:** `dpiit` passes on a present, well-formed number, since nothing sets `dpiit_verified` yet; the reason says whether it's verified. `turnover` fails above ₹25 Cr (the frontend's cap, kept deliberately even though DPIIT allows ₹100 Cr) and fails when the band isn't declared. `domain` is pending while the ML domain is NULL. `trl` requires claimed ≥ expected and passes when the problem has none. Add a rule with the `@rule` decorator.
    - **When it runs:** on solution submission, and again for pending checks when `ml_sync.run_extract` fills in the domain (upload or `retry_ml.py`, which also backfills unchecked solutions).
    - **Contract change:** `POST /api/solutions/:id/eligibility` re-runs the check (the owning officer or any evaluator). `GET` is for government roles only. The `Eligibility` response shape is new, with no `types.ts` equivalent yet; tell the frontend team.

One knock-on rename made *because of* #4, not an independent decision: `pilots.missed_milestones_count` was renamed to `failed_milestones_count`, since "missed" is no longer a valid milestone status — flagged here in case that's not wanted.

Known gap, not yet decided: `frontend/lib/api.ts`'s `logAuditEntry()` has no backing table in `schema.sql` at all. (The other old gap, the `extracted_tags` shape, was resolved in #15.)

### Stack
- **Framework:** FastAPI
- **Database:** PostgreSQL — database `sih_db`, user `postgres`, `localhost:5432` (local dev, Windows machine)
- **ORM:** SQLAlchemy
- **Auth:** JWT
- **Outbound calls:** `httpx` for the backend → ML service calls (never the reverse, never frontend → ML directly)

### `backend/` folder structure
The skeleton exists (config, database, models, `/health`, `init_db.py`, drift test), plus auth, the startup/problem/solution endpoints, the ML integration, and the eligibility engine. The pilot, evaluation, and scale modules are still planned and get created as endpoints are built. Models only map onto tables `schema.sql` creates; never call `Base.metadata.create_all()`.

```
backend/
├── schema.sql                # schema — don't edit without asking; see v2 change log above
├── docs/
│   ├── api_contract.md        # canonical API contract — don't edit without asking
│   └── ml_service.md          # ML service shapes, kept in sync with nlp/app/schemas.py
├── requirements.txt
├── init_db.py                # applies schema.sql via psycopg (psql isn't on PATH); --reset wipes + rebuilds
├── retry_ml.py               # re-runs ML work left pending while the ML service was down; prints counts
├── seed.py                   # SIH demo data through the service layer (so ML + eligibility run); --reset/--clear touch only @samarth.demo accounts
├── .env.example              # DATABASE_URL, JWT_SECRET, ML_SERVICE_URL, ML_TIMEOUT_SECONDS, FRONTEND_URL — never commit a real .env
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
│   │   ├── base.py               # CamelModel: snake_case fields, camelCase wire format — subclass it
│   │   ├── common.py             # TRL literal + "TRL-6"<->6, IST YYYY-MM-DD date formatting
│   │   ├── auth.py               # SignupRequest, LoginRequest, UserSession
│   │   ├── startup.py            # StartupProfileOut/Update, document shapes (no types.ts equivalent)
│   │   ├── problem.py            # ProblemCreate/Update/Out (= types.ts Problem)
│   │   ├── solution.py           # SolutionSubmit (multipart fields), SolutionOut (= types.ts Solution)
│   │   ├── eligibility.py        # EligibilityOut (no types.ts equivalent; defined in api_contract.md)
│   │   └── ml.py                 # copies of nlp/app/schemas.py response models; every ML response is validated against them
│   ├── routers/                  # one router per docs/api_contract.md section: auth, startups, problems, solutions (pilots, ... to come)
│   ├── services/
│   │   ├── auth_service.py       # register_user, authenticate, build_session (UserSession + dpiit join)
│   │   ├── startup_service.py    # profile read/update, document upload
│   │   ├── problem_service.py    # problem CRUD, submissionCount via one grouped subquery
│   │   ├── solution_service.py   # submit, visibility rules (startups see own only), status changes
│   │   ├── uploads.py            # PDF save (magic-byte check, 10 MB cap, random names) under UPLOAD_DIR
│   │   ├── ml_client.py          # httpx wrapper for nlp /extract, /summarize, /rank; every failure → MLUnavailable
│   │   ├── ml_sync.py            # runs the pipelines + stores results (extract→profile, summarize, rank_problem, retry_pending)
│   │   ├── eligibility.py        # rule engine (@rule registry) — runs on submission, re-runs when ML fills the domain
│   │   └── pilot_state_machine.py # enforces the pilot status transitions server-side
│   └── auth/                     # security.py (bcrypt, JWT), dependencies.py (get_current_user, require_role)
└── tests/
    ├── conftest.py               # db fixture: live sih_db, each test wrapped in a transaction that's rolled back; uploads → tmp_path; autouse FakeML (down by default)
    ├── helpers.py                # signup/auth/create_problem/submit_solution helpers shared by the tests
    ├── test_auth.py              # signup/login/me/require_role
    ├── test_startups.py          # profile, documents, upload limits
    ├── test_problems.py          # problem CRUD + role rules
    ├── test_solutions.py         # submit, visibility, status, PDF download
    ├── test_eligibility.py       # rules unit-tested, pass/fail/pending end to end, ML re-evaluation, endpoint roles
    ├── test_ml.py                # extract/summarize/rank wiring, pending on failure, force-rank, retry_pending
    ├── test_seed.py              # seed.py with ML down: counts, pending ML fields, the TRL failure, --clear
    ├── test_ml_live.py           # one end-to-end run against the REAL ML service; skipped unless RUN_LIVE_ML=1
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
pytest                             # drift, auth, startup/problem/solution tests (all roll back; no rows or files left behind)
uvicorn app.main:app --reload --port 8000   # GET /health checks DB connectivity
python retry_ml.py                 # fill in ML results left pending while the ML service was down
python seed.py                     # demo data + prints logins (password Samarth@2026); --reset rebuilds it, --clear removes it
$env:RUN_LIVE_ML = "1"; pytest tests/test_ml_live.py -q   # one real end-to-end ML check (ML service must be running)
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
