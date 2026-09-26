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

Request and response bodies are both camelCase. Optional fields that have no
value are **omitted** from the response (not sent as `null`), like the TS `?:`.
The password (and its hash) is never returned.

```
POST /api/auth/signup                                   → 201
  in:  { role, name, orgName, email, password, department?, dpiitNumber? }
       role:        "startup" | "govt_officer" | "evaluator"   ("admin" can't self-register → 422)
       startup:     dpiitNumber required, must match /^(DIPP|DPIIT)\d{5}$/i (stored uppercase);
                    creates the startup_profiles row immediately (dpiit_verified = false)
       govt_officer / evaluator: department required
       password:    8–72 bytes (bcrypt's limit)
       email:       stored lowercased; uniqueness is case-insensitive in practice
  out: UserSession { id, name, email, role, orgName, department?, dpiitNumber?, avatarUrl?, token }

POST /api/auth/login                                    → 200
  in:  { email, password }
  out: UserSession   (dpiitNumber comes from startup_profiles when role = 'startup')

GET /api/auth/me                                        → 200
  header: Authorization: Bearer <token>
  out: UserSession   (token echoes the one sent)
```

**Authenticated requests** send `Authorization: Bearer <token>`. The token is
an HS256 JWT (`sub` = user id, `role`, `exp`), valid 24h by default
(`JWT_EXPIRE_MINUTES`). The server re-reads the user from the DB on every
request and does not rely on the token's `role` claim.

**Errors**: `{ "detail": "..." }` (a FastAPI validation error has a list in `detail`)

| Status | When |
|---|---|
| 401 | missing/invalid/expired token (`WWW-Authenticate: Bearer`), or wrong email/password at login (the same message for both) |
| 403 | valid token, but the user's role isn't allowed on that endpoint |
| 409 | signup with an email that already exists |
| 422 | request body failed validation (missing role-specific field, bad DPIIT, `role: "admin"`, ...) |

### Conventions for the endpoints below
- Every endpoint needs `Authorization: Bearer <token>` (401 without one).
- Bodies are camelCase JSON, except uploads, which are `multipart/form-data`.
- Optional fields with no value are **omitted** from responses (the TS `?:`), not sent as `null`.
- Dates (`createdAt`, `submittedAt`, `deadline`, `uploadedAt`) are `YYYY-MM-DD` strings in IST,
  matching the format the frontend displays as-is.
- TRL values are `"TRL-3"` … `"TRL-9"` on the wire; the DB stores the bare number.
- **Government roles** means `govt_officer`, `evaluator` and `admin` (the frontend's `/gov` tree).

**PDF uploads** (startup documents, solution PDFs): field name `file`. Only real PDFs are
accepted — checked by the file's first bytes (`%PDF-`), not its name or Content-Type.
Max 10 MB. Files are saved under `backend/uploads/` with a random name; the client's
filename is only kept for display.

**Errors** (in addition to the auth table above):

| Status | When |
|---|---|
| 403 | right role but not *your* resource (editing another officer's problem, changing status on a solution to someone else's problem) |
| 404 | not found — **also** returned when a startup asks for another startup's solution, so its existence isn't revealed |
| 409 | a startup submitting a second proposal to the same problem |
| 413 | uploaded file over 10 MB |
| 415 | uploaded file isn't a PDF |

### Startup profile (Module 1)
There is no `StartupProfile` type in `frontend/lib/types.ts`; this shape follows
`frontend/app/(dashboard)/startup/profile/page.tsx`. The profile row is created at signup.
```
StartupProfile {
  userId, startupName, dpiitNumber, dpiitVerified,
  turnoverBand?, location?, incorporationYear?, description?,
  tags: string[], skills: string[],          -- empty until the ML /extract phase
  documents: [{ id, fileName, uploadedAt }]
}

GET   /api/startups/me                    startup only                 → 200 StartupProfile
PATCH /api/startups/me                    startup only                 → 200 StartupProfile
  in:  any of { startupName, dpiitNumber, turnoverBand, location, incorporationYear, description }
       omitted = unchanged; null clears an optional field
       startupName → users.org_name (so UserSession.orgName changes too); can't be emptied
       dpiitNumber → same regex as signup, stored uppercase; changing it resets dpiitVerified to false
       turnoverBand: "< ₹1Cr" | "₹1Cr–₹5Cr" | "₹5Cr–₹25Cr" | "> ₹25Cr"
POST  /api/startups/me/documents          startup only, multipart `file` → 201
  out: { id, fileName, uploadedAt, domain: "", tags: [], summary: "" }
       the last three are api.ts extractDocumentTags()'s shape — empty until ML /extract is wired in
GET   /api/startups/me/documents          startup only                 → 200 [{ id, fileName, uploadedAt }]
GET   /api/startups/:userId               government roles, or the startup itself → 200 StartupProfile
```

### Problems / forum (Module 2)
Response is `Problem` from `frontend/lib/types.ts` exactly. `code` (e.g. `PRB-2026-081`)
is assigned by the database; `submissionCount` is counted live; `status` is
`open | evaluating | pilot_active | completed`.
```
GET   /api/problems?domain=&status=&mine=true    any logged-in user   → 200 Problem[]  (newest first)
      mine=true → only problems posted by the caller
GET   /api/problems/:idOrCode                     any logged-in user   → 200 Problem    (api.ts getProblem)
POST  /api/problems                               govt_officer         → 201 Problem    (api.ts createProblem)
  in:  { title, department, ministry, domain, description, desiredOutcome, budgetBand, targetTRL, deadline }
       domain/budgetBand/targetTRL: the literal unions in types.ts; deadline YYYY-MM-DD, not in the past
PATCH /api/problems/:idOrCode                     govt_officer, own problems only → 200 Problem
  in:  any of the create fields, plus status; omitted = unchanged, null rejected
```

### Solutions (Module 2)
Response is `Solution` from `frontend/lib/types.ts` exactly:
- `startupId` is the startup's **user id** (the frontend compares it to `session.id`).
- `startupName` / `dpiitNumber` / `dpiitVerified` / `location` come from the startup's
  profile at read time — never from the submission.
- `matchScore` / `matchExplanation` / `matchedKeywords` are mapped from `rank_result`
  (the ML `/rank` result); until the ML phase they are `0` / `""` / `[]`.
- `pdfUrl` is `/api/solutions/:id/pdf` (relative to the backend; needs the Bearer header).
- `rubricScore` is the latest `evaluations` row; omitted if never scored.

**Visibility:** a startup only ever sees its own solutions, on every endpoint below
(filters can't widen that). Government roles see all.
```
POST  /api/problems/:idOrCode/solutions   startup only, multipart → 201 Solution   (api.ts submitSolution)
  in:  form fields title, abstract, claimedTRL, proposedCost (>0), proposedDurationWeeks (>0) + `file` (PDF, required)
       one proposal per startup per problem (409 on a second)
GET   /api/problems/:idOrCode/solutions   → 200 Solution[]  ranked: matchScore desc (unscored last), then oldest first
GET   /api/solutions?problemId=&startupId= → 200 Solution[]  newest first  (api.ts getSolutions, getProposalsByStartup;
                                                              startupId = user id)
GET   /api/solutions/:id                   → 200 Solution    (api.ts getSolution)
GET   /api/solutions/:id/pdf               → 200 application/pdf — same visibility as the solution
PATCH /api/solutions/:id/status            the officer who posted the problem, or any evaluator → 200 Solution
  in:  { status: "submitted" | "under_review" | "shortlisted" | "rejected" }   (api.ts updateSolutionStatus)
```
**Not yet built:** ML `/summarize` + `/rank` on submission, and the automatic eligibility
check — both come with the ML phase (eligibility's `domain_ok` needs the startup's
ML-extracted domain).

### Eligibility (Module 3) — build early, runs automatically
```
GET  /api/solutions/:id/eligibility
```
No manual POST — eligibility will be computed automatically as part of `POST /api/problems/:id/solutions`
(rule engine checks DPIIT status, turnover band, domain match, TRL, per `eligibility_checks` columns).
Deferred to the ML phase (see Solutions above); not built yet.

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
