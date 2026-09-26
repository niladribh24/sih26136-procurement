# API contract — SIH26136

This is the single canonical contract for the backend API. It replaces both the
original `backend/API_CONTRACT.md` (locked Day-1 draft) and the earlier
reverse-engineered `backend/docs/api_contract.md` (which marked everything
"ASSUMED" from frontend mock behavior) — those are merged into this file.

Two services talk over HTTP: the **backend** (owns Postgres) and the **ML
service** (`nlp/`, stateless, called by the backend). The **frontend** only
ever calls the backend — never the ML service directly.

## Source of truth & change policy

- `frontend/lib/types.ts` is the source of truth for API **response shapes**
  the backend must produce.
- The actual code in `nlp/app/schemas.py` (not any doc) is the source of truth
  for what the ML service returns.
- `backend/schema.sql` adapts to fit both of the above.
- Endpoint paths/methods below are the backend's own design (the frontend
  never calls them today — see `frontend/lib/api.ts`, which mocks everything
  via `localStorage`) — reasonable REST conventions picked to match what
  `ApiService` methods need, not something dictated elsewhere.
- Don't change a response shape, a schema column, or an ML field name without
  updating this file and confirming with the user first — see CLAUDE.md.

---

## 1. Backend API — base `/api`

### Auth
Both responses return the **full** `UserSession` shape from `frontend/lib/types.ts`
(not just `{user_id, token}`) so the frontend has everything it needs right
after login/signup with no follow-up call.

```
POST /api/auth/signup
  in:  { name, role, org_name, email, password, department? }
  out: { id, name, email, role, orgName, department?, dpiitNumber?, avatarUrl?, token }
       (dpiitNumber is null until the startup fills in their profile)

POST /api/auth/login
  in:  { email, password }
  out: { id, name, email, role, orgName, department?, dpiitNumber?, avatarUrl?, token }
       (dpiitNumber populated via join to startup_profiles when role = 'startup')
```

### Startup profile (Module 1)
```
POST /api/startups/me/profile       { description, dpiit_number, turnover_band }
POST /api/startups/me/documents     multipart file upload
     -> backend saves file, calls ML /extract, stores tags/skills/summary on the profile
GET  /api/startups/me                -> full profile incl. extracted_tags, extracted_skills
GET  /api/startups/:id                -> public profile view (for govt browsing)
```

### Problems / forum (Module 2)
```
POST /api/problems                  { title, domain, description, desired_outcome, budget_band, trl_expected }
GET  /api/problems                  -> list, filterable by domain/status
GET  /api/problems/:id
POST /api/problems/:id/solutions    { abstract_text } + file upload
     -> backend saves, calls ML /summarize and /rank, stores ai_summary + match_score + rank_result;
        then runs the eligibility rule engine automatically (see Module 3) and writes an eligibility_checks row
GET  /api/problems/:id/solutions    -> ranked list, sorted by match_score desc
GET  /api/solutions                 -> list, filterable by ?problem_id= and/or ?startup_id=
GET  /api/solutions/:id
```
`rank_result` (the full ML `/rank` response for that solution) is mapped by the API layer
into the frontend's flat `matchScore` / `matchExplanation` / `matchedKeywords` fields —
see `backend/schema.sql`'s `solution_abstracts.rank_result` comment for the exact shape.

### Eligibility (Module 3) — build early, runs automatically
```
GET  /api/solutions/:id/eligibility
```
No manual POST — eligibility is computed automatically as part of `POST /api/problems/:id/solutions`
(rule engine checks DPIIT status, turnover band, domain match, TRL, per `eligibility_checks` columns).

### Evaluation (Module 4)
```
POST /api/solutions/:id/rubric      { technicalMerit, costRealism, teamCapability, timelineViability, comments? }
GET  /api/solutions/:id/rubric
```
Fields and 30/20/20/30 scale match `frontend/lib/types.ts` `Solution.rubricScore` and
`evaluations` table columns exactly.

### Pilots (Module 5)
```
POST  /api/pilots                     { problem_id, startup_id, objective, success_metrics, budget_cap, start_date, end_date }
GET   /api/pilots
GET   /api/pilots/:id
PATCH /api/pilots/:id/status          { status }   -- enforce allowed transitions server-side, see state machine below
POST  /api/pilots/:id/milestones      { title, due_date, trancheAmount, tranchePercentage }
```

### Milestones & tranches (Module 5 + old Module 7, now merged)
`payment_tranches` no longer exists as a separate resource — tranche amount, percentage,
disbursed flag and disbursed timestamp live directly on the milestone
(`pilot_milestones` table), matching `frontend/lib/types.ts` `Milestone`.
```
PATCH /api/pilots/:pilotId/milestones/:milestoneId/deliverable
  in:  { achievedKPI, fileUrl }
  -- sets status='submitted', clears any prior verification stamp

PATCH /api/pilots/:pilotId/milestones/:milestoneId/verify
  in:  { verifiedBy, remarks, status: "verified" | "failed", verificationReportUrl? }
  -- validator must differ from the evaluator who scored this solution's rubric
  -- status='failed' twice on a pilot increments pilots.failed_milestones_count and flags it for review
  -- all milestones verified -> pilot.status auto-advances to 'completed'

PATCH /api/pilots/:pilotId/milestones/:milestoneId/disburse
  -- sets tranche_disbursed=true, disbursed_at=now()
```

### IP / Data agreements, KPIs, independent validation (cross-cutting) — deferred
Tables (`ip_agreements`, `kpi_logs`, `validations`) exist in `schema.sql` but **no
endpoints are planned yet** — nothing in `frontend/lib/api.ts` calls them today.
Build these last, after everything the frontend actually uses is working. Sketch,
for when we get there:
```
POST  /api/pilots/:id/ip-agreement    { ip_clause_type, data_sharing_terms, cybersecurity_clause, risk_clause }
PATCH /api/ip-agreements/:id/sign     { signed_by }  -- 'startup' | 'dept'
POST  /api/pilots/:id/kpi             { metric_name, target_value, actual_value }
GET   /api/pilots/:id/kpi
POST  /api/pilots/:id/validate        { outcome, notes }   -- validator must != the evaluator on this solution
```

### Procurement (Module 9) — deferred
Table (`procurement_records`) exists but **no endpoints are planned yet** — the
frontend's Sanction Docket screen currently reads `sanctionDocketId` /
`sanctionOrderRef` straight off `Pilot` with no dedicated procurement call. Sketch:
```
POST /api/pilots/:id/procure         -> pulls pilot KPIs + eligibility + budget from DB,
                                         renders procurement_package (PDF/JSON), returns url
GET  /api/procurement/:id
```

### Scale (Module 10)
```
GET  /api/proven-solutions                       -> all completed procurements, filterable by domain
GET  /api/replications                            -> all replication requests
POST /api/proven-solutions/:id/replicate
  in:  { pilotId, requestingOfficerName, requestingOfficerEmail, targetDeploymentSite,
         targetQuantity, targetBudget?, deploymentTimelineWeeks? }
  -> creates a replication_requests row (status defaults to 'pending')
```
`replication_requests` was extended with `pilot_id` and the `requesting_officer_*`/`target_*`/
`deployment_timeline_weeks` columns (see `schema.sql`), and its status enum changed to
`pending/approved/in_pilot` (not the old `requested/approved/rejected`) — but it stays
normalized. `solutionTitle`, `startupName`, `originatingDepartment`, and
`requestingDepartment` in the `GET` responses are **not** stored columns — the API layer
fills them in via joins at read time:
- `solutionTitle` / `startupName` / `originatingDepartment`: `proven_solution_id` →
  `procurement_records` → `pilots` → `problems` / `solution_abstracts` / `startup_profiles`
- `requestingDepartment`: `requesting_dept_id` → `users.org_name`

This avoids a copy of those facts that can drift from the real record — join them fresh
on every read instead of caching them on the row.

---

## 2. ML service API — base `/ml` (actually `nlp/`, port `:8001`), called only by the backend

This section is a summary only. **`backend/docs/ml_service.md` is authoritative** for
exact ML request/response shapes — it's kept in sync with the real
`nlp/app/schemas.py`, not a design doc. Endpoints: `POST /extract` (PDF or raw text in,
domain/tags/skills/summary/TRL estimate out — no embedding), `POST /summarize`
(text in, summary + technical claims + cost/timeline summary out), `POST /rank`
(problem + candidate solutions in, ranked match results with a full semantic
breakdown out). The ML service never touches Postgres; the backend is the only
thing that writes to the DB.

---

## 3. Pilot state machine (enforce server-side, not just in the UI)

```
proposed -> under_review -> approved -> active -> completed
                                            |
                                            -> failed
completed -> recommended_for_procurement
```

No other transitions are valid. Reject invalid `PATCH /pilots/:id/status`
calls with a 400. (Milestone status is a separate, unrelated state machine —
`pending -> submitted -> verified` or `-> failed` — see Module 5 above.)

---

## 4. Build priority

1. Everything `frontend/lib/api.ts` calls: auth, problems, solutions (+ automatic
   eligibility check + ML summarize/rank on submission), pilots, milestones/tranches,
   rubric scoring, scale/replication.
2. The eligibility rule engine specifically — build it alongside solution submission,
   not after.
3. IP agreements, KPI logs, independent validations, procurement records — tables
   only for now, endpoints later once the frontend grows UI for them.
