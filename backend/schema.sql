-- ============================================================
-- SIH26136 — Startup-Friendly Public Procurement Platform
-- Database schema (Postgres)
-- Owned by: Person A (backend)
--
-- v2 — revised after reconciling this schema against frontend/lib/types.ts
-- (API response shapes) and the actual nlp/ service code (what ML really
-- returns). See CLAUDE.md "Contract & schema change policy" for the rule
-- that governs future changes: frontend/lib/types.ts wins on API shape,
-- nlp/ code wins on ML shape, this file adapts to fit both.
--
-- Still locked in the sense that changes go through the backend developer
-- first — if you need a new column, add it here and say so, don't let
-- app code and schema drift apart.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------- Users & roles ----------
CREATE TYPE user_role AS ENUM ('startup', 'govt_officer', 'admin', 'evaluator');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role            user_role NOT NULL,
    name            TEXT NOT NULL,          -- person's display name (distinct from org_name) — required by frontend UserSession.name
    org_name        TEXT NOT NULL,
    department      TEXT,                   -- govt_officer / evaluator's department, e.g. "Division of Precision Agriculture" — UserSession.department
    avatar_url      TEXT,                   -- UserSession.avatarUrl
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    verified        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT now()
);
-- Note: JWTs are not persisted — UserSession.token is minted at login time, not stored.
-- Note: UserSession.dpiitNumber (startup role only) is read from startup_profiles via join, not duplicated here.

-- ---------- Module 1: Startup Discovery ----------
CREATE TABLE startup_profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,  -- one profile per user; UNIQUE also gives Postgres an index for the user_id lookup
    dpiit_number    TEXT,
    dpiit_verified  BOOLEAN DEFAULT FALSE,
    turnover_band   TEXT,                 -- e.g. "<1cr", "1-5cr" — used by eligibility engine
    description     TEXT,
    location        TEXT,                 -- e.g. "Bengaluru, Karnataka" — shown on every Solution (frontend Solution.location) via join
    incorporation_year INT,               -- edited on the startup profile page
    domain          TEXT,                 -- ML-classified domain (from /extract, most confident document) — used by eligibility domain_ok
    extracted_tags  JSONB DEFAULT '[]',   -- flat strings, as /extract returns them: ["Computer Vision", ...] — union across documents
    extracted_skills JSONB DEFAULT '[]',  -- flat strings: ["edge inference", ...] — union across documents
    embedding       REAL[],               -- nullable; no pgvector (hard to install on Windows) — /rank does its own similarity, this is unused until we have a use for it
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE startup_documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    startup_id      UUID REFERENCES startup_profiles(id) ON DELETE CASCADE,
    file_path       TEXT NOT NULL,        -- relative to the uploads dir, e.g. startup_docs/<uuid>.pdf (never the client's filename)
    original_filename TEXT,               -- the name the user uploaded, for display only
    extracted_text  TEXT,
    extract_result  JSONB,                -- the *entire* ML /extract response, verbatim (domain, confidence, tags, skills, summary,
                                           -- extracted_trl_estimate, ocr_performed). NULL = pending (ML was down) — retry_ml.py fills it.
    uploaded_at     TIMESTAMPTZ DEFAULT now()
);

-- ---------- Module 2: Problem Statement Forum + Matching ----------
-- Values match frontend/lib/types.ts Problem.status exactly (was open/under_review/closed).
CREATE TYPE problem_status AS ENUM ('open', 'evaluating', 'pilot_active', 'completed');

-- Feeds problems.code. A sequence (not COUNT(*)+1) so two officers posting at the same
-- moment can never get the same number.
CREATE SEQUENCE problem_code_seq;

CREATE TABLE problems (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    posted_by       UUID REFERENCES users(id),
    code            TEXT UNIQUE NOT NULL  -- human-readable id, e.g. PRB-2026-081 — frontend Problem.code; getProblem() accepts id or code
                        DEFAULT ('PRB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('problem_code_seq')::text, 3, '0')),
    title           TEXT NOT NULL,
    department      TEXT,                 -- defaults to the officer's department in the UI, but editable per problem
    ministry        TEXT,                 -- defaults to the officer's org_name in the UI, but editable per problem
    domain          TEXT NOT NULL,
    description     TEXT NOT NULL,
    desired_outcome TEXT NOT NULL,
    budget_band     TEXT,
    trl_expected    INT,                  -- 1-9; API maps to/from frontend "TRL-6" strings
    deadline        DATE,                 -- frontend Problem.deadline
    status          problem_status DEFAULT 'open',
    embedding       REAL[],               -- nullable; see startup_profiles.embedding note above
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Values match frontend/lib/types.ts Solution.status exactly.
CREATE TYPE solution_status AS ENUM ('submitted', 'under_review', 'shortlisted', 'rejected');

CREATE TABLE solution_abstracts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    problem_id      UUID REFERENCES problems(id) ON DELETE CASCADE,
    startup_id      UUID REFERENCES startup_profiles(id) ON DELETE CASCADE,
    title           TEXT,
    abstract_text   TEXT,
    claimed_trl     INT,                  -- 1-9; API maps to/from frontend "TRL-6" strings
    proposed_cost   NUMERIC,              -- rupees
    proposed_duration_weeks INT,
    status          solution_status DEFAULT 'submitted',
    file_path       TEXT,                 -- uploaded solution PDF
    ai_summary      TEXT,                 -- NLP-generated summary of the PDF (from /summarize). NULL = pending.
    summary_result  JSONB,                -- the *entire* /summarize response (summary, technical_claims, cost_timeline_summary)
    match_score     NUMERIC,              -- 0-1, mirrors rank_result->>'match_score' for easy sorting/filtering
    rank_result     JSONB,                -- the *entire* /rank RankResult object for this solution, verbatim from nlp/app/schemas.py:
                                           -- { solution_id, match_score, match_percent, rank, match_explanation, matched_keywords, semantic_breakdown }
                                           -- API layer maps this to frontend's matchScore / matchExplanation / matchedKeywords fields.
    submitted_at    TIMESTAMPTZ DEFAULT now(),
    -- One proposal per startup per problem. The UI checks too, but only this can't be bypassed.
    -- Its index also covers lookups by problem_id alone (leftmost column).
    CONSTRAINT solution_abstracts_problem_startup_key UNIQUE (problem_id, startup_id)
);

-- ---------- Module 3: Eligibility Screening ----------
-- Filled by the rule engine (app/services/eligibility.py) on solution submission; one row per
-- solution, updated in place when the check is re-run. Each *_ok column: TRUE = pass,
-- FALSE = fail, NULL = pending (e.g. domain_ok while ML hasn't classified the startup yet).
-- overall_eligible follows SQL's three-valued AND: any FALSE -> FALSE, all TRUE -> TRUE,
-- otherwise (something pending, nothing failed) NULL.
CREATE TABLE eligibility_checks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    solution_id     UUID REFERENCES solution_abstracts(id) ON DELETE CASCADE,
    dpiit_ok        BOOLEAN,
    turnover_ok     BOOLEAN,
    domain_ok       BOOLEAN,
    trl_ok          BOOLEAN,
    overall_eligible BOOLEAN GENERATED ALWAYS AS (dpiit_ok AND turnover_ok AND domain_ok AND trl_ok) STORED,
    rule_results    JSONB,                -- every rule's outcome, as of checked_at:
                                           -- [{ "rule": "dpiit", "status": "pass"|"fail"|"pending", "reason": "..." }, ...]
    checked_at      TIMESTAMPTZ DEFAULT now()
);

-- ---------- Module 4: Expert Evaluation ----------
-- Rubric fields match frontend/lib/types.ts Solution.rubricScore exactly (not the old
-- innovation/feasibility/impact fields, which had no frontend equivalent).
CREATE TABLE evaluations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    solution_id         UUID REFERENCES solution_abstracts(id) ON DELETE CASCADE,
    evaluator_id        UUID REFERENCES users(id),
    technical_merit     NUMERIC,          -- 0-30
    cost_realism        NUMERIC,          -- 0-20
    team_capability     NUMERIC,          -- 0-20
    timeline_viability  NUMERIC,          -- 0-30
    total_score         NUMERIC GENERATED ALWAYS AS
                            (technical_merit + cost_realism + team_capability + timeline_viability) STORED, -- 0-100
    comments            TEXT,
    evaluated_at        TIMESTAMPTZ DEFAULT now()
);

-- ---------- Module 5: Pilot Sandbox ----------
CREATE TYPE pilot_status AS ENUM (
    'proposed', 'under_review', 'approved', 'active',
    'completed', 'failed', 'recommended_for_procurement'
);

CREATE TABLE pilots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    problem_id      UUID REFERENCES problems(id),
    startup_id      UUID REFERENCES startup_profiles(id),
    objective       TEXT,
    success_metrics JSONB,                -- [{ "metric": "processing time", "target": "-30%" }]
    status          pilot_status DEFAULT 'proposed',
    budget_cap      NUMERIC,
    start_date      DATE,
    end_date        DATE,
    failed_milestones_count INT DEFAULT 0, -- auto-incremented when a milestone is marked 'failed' (renamed from missed_milestones_count — 'missed' is no longer a valid milestone_status value); triggers risk flag at 2
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Milestone status enum matches frontend/lib/types.ts Milestone.status exactly
-- (old TEXT column used 'pending'/'done'/'missed', which didn't match).
-- Tranche fields are inlined here — the payment_tranches table is gone (Module 7),
-- because the frontend has no separate Payment/Tranche object: it stores tranche
-- amount/percentage/disbursed state directly on the milestone.
CREATE TYPE milestone_status AS ENUM ('pending', 'submitted', 'verified', 'failed');

CREATE TABLE pilot_milestones (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pilot_id            UUID REFERENCES pilots(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    due_date            DATE,
    status              milestone_status DEFAULT 'pending',
    evidence_url        TEXT,
    completed_at        TIMESTAMPTZ,
    tranche_amount      NUMERIC,             -- moved from payment_tranches.amount
    tranche_percentage  NUMERIC,             -- new — frontend Milestone.tranchePercentage
    tranche_disbursed   BOOLEAN DEFAULT FALSE, -- moved from payment_tranches.status = 'released'
    disbursed_at        TIMESTAMPTZ           -- moved from payment_tranches.released_at
);

-- ---------- Cross-cutting: IP & Data Governance ----------
-- Table retained; no endpoints planned yet (low priority — frontend doesn't call anything for this).
CREATE TABLE ip_agreements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pilot_id        UUID REFERENCES pilots(id) ON DELETE CASCADE,
    ip_clause_type  TEXT,                  -- 'startup_retains' / 'govt_license' / 'joint_ip'
    data_sharing_terms TEXT,
    cybersecurity_clause TEXT,
    risk_clause     TEXT,
    signed_by_startup BOOLEAN DEFAULT FALSE,
    signed_by_dept  BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ---------- Cross-cutting: KPI & independent validation ----------
-- Tables retained; no endpoints planned yet (low priority — frontend doesn't call anything for this).
CREATE TABLE kpi_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pilot_id        UUID REFERENCES pilots(id) ON DELETE CASCADE,
    metric_name     TEXT,
    target_value    NUMERIC,
    actual_value    NUMERIC,
    logged_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE validations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pilot_id        UUID REFERENCES pilots(id) ON DELETE CASCADE,
    validated_by    UUID REFERENCES users(id),  -- must differ from the evaluator on the same solution
    outcome         TEXT,                        -- 'validated' / 'rejected'
    notes           TEXT,
    validated_at    TIMESTAMPTZ DEFAULT now()
);

-- ---------- Module 9: Procurement Bridge ----------
-- Table retained; no endpoints planned yet (low priority — frontend's Sanction Docket
-- screen currently reads sanctionDocketId/sanctionOrderRef straight off Pilot).
CREATE TABLE procurement_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pilot_id        UUID REFERENCES pilots(id),
    procurement_package_url TEXT,          -- generated PDF/JSON
    compliance_checklist JSONB,            -- { "eligibility_verified": true, "pilot_kpis_met": true, ... }
    status          TEXT DEFAULT 'pending', -- pending / issued
    procured_at     TIMESTAMPTZ
);

-- ---------- Module 10: Scale & Replication ----------
CREATE TABLE proven_solutions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    procurement_id  UUID REFERENCES procurement_records(id),
    replicable      BOOLEAN DEFAULT TRUE,
    replication_requests_count INT DEFAULT 0
);

-- Extended to match frontend/lib/types.ts ReplicationRequest exactly. Kept normalized
-- rather than denormalized: proven_solution_id/pilot_id/requesting_dept_id are the only
-- identity columns. solutionTitle, startupName, originatingDepartment and
-- requestingDepartment are NOT stored here — the API fills them in via joins at read time
-- (proven_solution_id -> procurement_records -> pilots -> problems/solution_abstracts/
-- startup_profiles for the first three; requesting_dept_id -> users.org_name for the
-- fourth), so there's one place these facts live instead of a copy that can go stale.
-- requesting_officer_name/email, target_*, and deployment_timeline_weeks are genuinely
-- new data entered on the replication request itself, so those ARE real columns.
CREATE TABLE replication_requests (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proven_solution_id          UUID REFERENCES proven_solutions(id) ON DELETE CASCADE,
    pilot_id                    UUID REFERENCES pilots(id),          -- frontend ReplicationRequest.pilotId
    requesting_dept_id          UUID REFERENCES users(id),           -- join -> users.org_name for frontend .requestingDepartment
    requesting_officer_name     TEXT,                                 -- frontend .requestingOfficerName
    requesting_officer_email    TEXT,                                 -- frontend .requestingOfficerEmail
    target_deployment_site      TEXT,                                 -- frontend .targetDeploymentSite
    target_quantity             INT,                                  -- frontend .targetQuantity
    target_budget                NUMERIC,                              -- frontend .targetBudget (optional)
    deployment_timeline_weeks   INT,                                  -- frontend .deploymentTimelineWeeks (optional)
    status                      TEXT NOT NULL DEFAULT 'pending'       -- pending / approved / in_pilot (frontend enum — was requested/approved/rejected)
                                    CONSTRAINT replication_requests_status_check
                                    CHECK (status IN ('pending', 'approved', 'in_pilot')),
    requested_at                TIMESTAMPTZ DEFAULT now()
);

-- ---------- Indexes worth adding on day 1 ----------
-- (solution_abstracts.problem_id is covered by the UNIQUE (problem_id, startup_id) index.)
CREATE INDEX ON problems (posted_by);
CREATE INDEX ON solution_abstracts (startup_id);
CREATE INDEX ON pilots (problem_id);
CREATE INDEX ON pilots (startup_id);
CREATE INDEX ON pilot_milestones (pilot_id);
-- Postgres doesn't auto-index foreign key columns; these back "all X for this solution" lookups.
CREATE INDEX ON evaluations (solution_id);
CREATE INDEX ON eligibility_checks (solution_id);
CREATE INDEX ON replication_requests (proven_solution_id);
