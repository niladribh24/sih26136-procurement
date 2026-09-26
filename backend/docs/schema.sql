-- ============================================================
-- SIH26136 — Startup-Friendly Public Procurement Platform
-- Database schema (Postgres + pgvector)
-- Owned by: Person A (backend)
-- Locked on Day 1 — everyone else builds against this file.
-- If you need a new column, add it here first and tell the group.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------- Users & roles ----------
CREATE TYPE user_role AS ENUM ('startup', 'govt_officer', 'admin', 'evaluator');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role            user_role NOT NULL,
    org_name        TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    verified        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ---------- Module 1: Startup Discovery ----------
CREATE TABLE startup_profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    dpiit_number    TEXT,
    dpiit_verified  BOOLEAN DEFAULT FALSE,
    turnover_band   TEXT,                 -- e.g. "<1cr", "1-5cr" — used by eligibility engine
    description     TEXT,
    extracted_tags  JSONB DEFAULT '[]',   -- [{ "domain": "AgriTech", "confidence": 0.87 }, ...]
    extracted_skills JSONB DEFAULT '[]',  -- [{ "skill": "computer vision", "confidence": 0.81 }, ...]
    embedding       VECTOR(384),          -- all-MiniLM-L6-v2 dim
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE startup_documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    startup_id      UUID REFERENCES startup_profiles(id) ON DELETE CASCADE,
    file_path       TEXT NOT NULL,
    extracted_text  TEXT,
    uploaded_at     TIMESTAMPTZ DEFAULT now()
);

-- ---------- Module 2: Problem Statement Forum + Matching ----------
CREATE TYPE problem_status AS ENUM ('open', 'under_review', 'closed');

CREATE TABLE problems (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    posted_by       UUID REFERENCES users(id),
    title           TEXT NOT NULL,
    domain          TEXT NOT NULL,
    description     TEXT NOT NULL,
    desired_outcome TEXT NOT NULL,
    budget_band     TEXT,
    trl_expected    INT,                  -- 1-9
    status          problem_status DEFAULT 'open',
    embedding       VECTOR(384),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE solution_abstracts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    problem_id      UUID REFERENCES problems(id) ON DELETE CASCADE,
    startup_id      UUID REFERENCES startup_profiles(id) ON DELETE CASCADE,
    abstract_text   TEXT,
    file_path       TEXT,                 -- uploaded solution PDF
    ai_summary      TEXT,                 -- NLP-generated summary of the PDF
    match_score     NUMERIC,              -- 0-1 semantic similarity
    match_explain   JSONB,                -- [{ "phrase": "soil moisture sensing", "weight": 0.42 }, ...]
    submitted_at    TIMESTAMPTZ DEFAULT now()
);

-- ---------- Module 3: Eligibility Screening ----------
CREATE TABLE eligibility_checks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    solution_id     UUID REFERENCES solution_abstracts(id) ON DELETE CASCADE,
    dpiit_ok        BOOLEAN,
    turnover_ok     BOOLEAN,
    domain_ok       BOOLEAN,
    trl_ok          BOOLEAN,
    overall_eligible BOOLEAN GENERATED ALWAYS AS (dpiit_ok AND turnover_ok AND domain_ok AND trl_ok) STORED,
    checked_at      TIMESTAMPTZ DEFAULT now()
);

-- ---------- Module 4: Expert Evaluation ----------
CREATE TABLE evaluations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    solution_id     UUID REFERENCES solution_abstracts(id) ON DELETE CASCADE,
    evaluator_id    UUID REFERENCES users(id),
    innovation_score NUMERIC,             -- 0-10 rubric fields, adjust to your rubric
    feasibility_score NUMERIC,
    impact_score    NUMERIC,
    total_score     NUMERIC GENERATED ALWAYS AS (innovation_score + feasibility_score + impact_score) STORED,
    comments        TEXT,
    evaluated_at    TIMESTAMPTZ DEFAULT now()
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
    missed_milestones_count INT DEFAULT 0, -- auto-incremented, triggers risk flag at 2
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pilot_milestones (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pilot_id        UUID REFERENCES pilots(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    due_date        DATE,
    status          TEXT DEFAULT 'pending',  -- pending / done / missed
    evidence_url    TEXT,
    completed_at    TIMESTAMPTZ
);

-- ---------- Module 7: Milestone-based payment ----------
CREATE TABLE payment_tranches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    milestone_id    UUID REFERENCES pilot_milestones(id) ON DELETE CASCADE,
    amount          NUMERIC NOT NULL,
    status          TEXT DEFAULT 'pending', -- pending / released
    released_at     TIMESTAMPTZ
);

-- ---------- Cross-cutting: IP & Data Governance ----------
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

CREATE TABLE replication_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proven_solution_id UUID REFERENCES proven_solutions(id) ON DELETE CASCADE,
    requesting_dept_id UUID REFERENCES users(id),
    status          TEXT DEFAULT 'requested', -- requested / approved / rejected
    requested_at    TIMESTAMPTZ DEFAULT now()
);

-- ---------- Indexes worth adding on day 1 ----------
CREATE INDEX ON solution_abstracts (problem_id);
CREATE INDEX ON solution_abstracts (startup_id);
CREATE INDEX ON pilots (problem_id);
CREATE INDEX ON pilots (startup_id);
CREATE INDEX ON pilot_milestones (pilot_id);
-- pgvector similarity index (build after you have real embeddings, not on empty table)
-- CREATE INDEX ON problems USING ivfflat (embedding vector_cosine_ops);
-- CREATE INDEX ON startup_profiles USING ivfflat (embedding vector_cosine_ops);
