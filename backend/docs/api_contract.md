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
| 409 | a startup submitting a second proposal to the same problem; shortlisting or piloting an ineligible proposal; a second pilot for one proposal |
| 413 | uploaded file over 10 MB |
| 415 | uploaded file isn't a PDF |

### Startup profile (Module 1)
There is no `StartupProfile` type in `frontend/lib/types.ts`; this shape follows
`frontend/app/(dashboard)/startup/profile/page.tsx`. The profile row is created at signup.
```
StartupProfile {
  userId, startupName, dpiitNumber, dpiitVerified, domain?,
  turnoverBand?, location?, incorporationYear?, description?,
  tags: string[], skills: string[],          -- union across the startup's extracted documents
  documents: [{ id, fileName, uploadedAt, extractionStatus: "done" | "pending" }]
}
domain = the most confident /extract classification across documents (one of Problem.domain's six values)

GET   /api/startups/me                    startup only                 → 200 StartupProfile
PATCH /api/startups/me                    startup only                 → 200 StartupProfile
  in:  any of { startupName, dpiitNumber, turnoverBand, location, incorporationYear, description }
       omitted = unchanged; null clears an optional field
       startupName → users.org_name (so UserSession.orgName changes too); can't be emptied
       dpiitNumber → same regex as signup, stored uppercase; changing it resets dpiitVerified to false
       turnoverBand: "< ₹1Cr" | "₹1Cr–₹5Cr" | "₹5Cr–₹25Cr" | "> ₹25Cr"
POST  /api/startups/me/documents          startup only, multipart `file` → 201
  out: { id, fileName, uploadedAt, extractionStatus, domain, tags, skills, summary }
       domain/tags/summary are api.ts extractDocumentTags()'s shape. The backend sends the PDF to ML
       /extract right after saving it. If ML is down/slow/erroring the upload still succeeds with
       extractionStatus "pending" and "" / [] values — see "ML pending & retry" below.
GET   /api/startups/me/documents          startup only                 → 200 [{ id, fileName, uploadedAt, extractionStatus }]
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
  (the ML `/rank` result). Until a solution is ranked they are `0` /
  `"AI match analysis pending."` / `[]` (`Solution` has no pending flag, so the text says it).
- `pdfUrl` is `/api/solutions/:id/pdf` (relative to the backend; needs the Bearer header).
- `rubricScore` is the latest `evaluations` row; omitted if never scored.

**Visibility:** a startup only ever sees its own solutions, on every endpoint below
(filters can't widen that). Government roles see all.
```
POST  /api/problems/:idOrCode/solutions   startup only, multipart → 201 Solution   (api.ts submitSolution)
  in:  form fields title, abstract, claimedTRL, proposedCost (>0), proposedDurationWeeks (>0) + `file` (PDF, required)
       one proposal per startup per problem (409 on a second)
GET   /api/problems/:idOrCode/solutions   → 200 Solution[]  ranked: matchScore desc (unscored last), then oldest first
      for government roles: if any solution is unranked, the backend first ranks ALL of the
      problem's solutions in one ML /rank call and saves the results; if ML is down it just
      returns the list with the unranked ones pending (never an error). Startups never trigger it.
POST  /api/problems/:idOrCode/solutions/rank   the officer who posted the problem, or any evaluator
      → 200 Solution[] (ranked)   forces a fresh /rank of every solution; 503 if ML is down
GET   /api/solutions?problemId=&startupId= → 200 Solution[]  newest first  (api.ts getSolutions, getProposalsByStartup;
                                                              startupId = user id)
GET   /api/solutions/:id                   → 200 Solution    (api.ts getSolution)
GET   /api/solutions/:id/pdf               → 200 application/pdf — same visibility as the solution
PATCH /api/solutions/:id/status            the officer who posted the problem, or any evaluator → 200 Solution
  in:  { status: "submitted" | "under_review" | "shortlisted" | "rejected" }   (api.ts updateSolutionStatus)
```
On submission the backend also calls ML `/summarize` and stores the result
(`solution_abstracts.ai_summary` + `summary_result`). The input is the solution PDF's
text (pypdf), or the abstract if the PDF has under 200 characters of text (e.g. a scan).
The summary is **not** in the response: `Solution` in `types.ts` has no field for it.
Submission also runs the eligibility check (below) and stores the result.

### ML pending & retry
The backend is the only caller of the ML service (`ML_SERVICE_URL`; timeouts: 2 s connect,
`ML_TIMEOUT_SECONDS` read, default 60). No endpoint above fails because ML is down:
uploads and submissions are committed first, then ML runs. Anything that didn't get ML
results stays **pending** (`extract_result` / `ai_summary` / `rank_result` NULL). To fill
it in later, run from `backend/`:
```
python retry_ml.py     # extracts pending documents, summarizes pending solutions,
                       # ranks every problem with an unranked solution; prints counts
```
Ranking also catches up by itself the next time an officer/evaluator lists the problem's solutions.

### Eligibility (Module 3) — runs automatically on submission
```
GET  /api/solutions/:id/eligibility   govt_officer / evaluator / admin → 200 Eligibility   (startup: 403)
POST /api/solutions/:id/eligibility   the officer who posted the problem, or any evaluator → 200 Eligibility
                                      re-runs every rule against the current profile/problem
```
`types.ts` has no equivalent, so the shape is defined here:
```
Eligibility {
  solutionId: string
  status: "eligible" | "ineligible" | "pending"
  overallEligible: boolean | null      // null while pending
  checkedAt: string                    // ISO 8601
  rules: { rule: "dpiit" | "turnover" | "domain" | "trl", label: string,
           status: "pass" | "fail" | "pending", reason: string }[]
}
```
The rules (`backend/app/services/eligibility.py`):

| rule | pass | fail | pending |
|---|---|---|---|
| `dpiit` | DPIIT number present and valid (`^(DIPP\|DPIIT)\d{5}$`); the reason says whether it's verified | missing / malformed | — |
| `turnover` | band `< ₹1Cr`, `₹1Cr–₹5Cr` or `₹5Cr–₹25Cr` | `> ₹25Cr`, or not declared | — |
| `domain` | `startup_profiles.domain` (ML `/extract`) equals the problem's domain | different domain | domain not classified yet (ML pending, or no document uploaded) |
| `trl` | claimed TRL ≥ the problem's, or the problem has none | below the problem's | — |

`status` is `ineligible` if any rule fails, else `pending` if any is pending, else `eligible`.
Pending checks are re-evaluated automatically when `/extract` classifies the startup's domain
(on document upload, or by `python retry_ml.py`). Anything else (e.g. the startup declaring its
turnover later) needs a re-run via POST. One `eligibility_checks` row per solution, updated in place.

### Evaluation (Module 4)
```
POST /api/solutions/:id/rubric   the officer who posted the problem, or any evaluator → 200 Solution
  in:  { technicalMerit 0–30, costRealism 0–20, teamCapability 0–20, timelineViability 0–30, comments? }
       out of range → 422   (api.ts updateSolutionRubric)
```
Fields and 30/20/20/30 scale match `frontend/lib/types.ts` `Solution.rubricScore` and
`evaluations` table columns exactly. Every save inserts a new `evaluations` row (with
`evaluator_id` = the caller), so the history is kept; `Solution.rubricScore` is the newest one.
There is no `GET /rubric`: the score is already on every `Solution` response.

### Pilots (Module 5)
Response is `Pilot` from `frontend/lib/types.ts` exactly (optional fields omitted when empty):
- `code` (`PLT-2026-001`) is assigned by the database, like `Problem.code`.
- `status` is the display label (`"Under review"`, `"Recommended for procurement"`, …); the DB
  stores the enum value (`under_review`, …).
- `startupId` is the startup's **user id**, like `Solution.startupId`.
- `startupName` / `dpiitNumber` / `dpiitVerified` come from the startup profile, `department` /
  `ministry` from the problem, `leadOfficerName` is the name of the officer who posted the problem.
- `totalBudget` = `pilots.budget_cap`; `durationWeeks` = `(end_date − start_date) / 7`;
  `completionDate` = when the pilot entered `completed` (from `pilot_status_history`).
- `performanceScore` (0–100, 1 decimal) is omitted until a milestone is verified:
  ```
  score = 100 × (0.4·R + 0.4·Q + 0.2·T)
  R = latest rubric total / 100
  Q = verified milestones / (verified milestones + failed_milestones_count)
  T = share of verified milestones verified on or before their due date (IST)
  ```
  With no rubric, R is dropped and Q/T weigh 2/3 and 1/3 (`pilot_service.performance_score`).
- `sanctionDocketId` (the `procurement_records.id`) and `sanctionOrderRef` (`SAN/<year>/<pilot code>`,
  derived at read time) are present only once the pilot is Procured.

**Visibility:** a startup sees only its own pilots (anyone else's is a 404); government roles see all.
```
POST  /api/pilots                     the officer who posted the problem → 201 Pilot   (api.ts createPilot)
  in:  { solutionId, independentValidatorName, durationWeeks, totalBudget,
         milestones: [{ sequence, title, description, targetKPI, deliverableDueWeek, tranchePercentage }] }
       other Pilot fields api.ts sends are ignored — they're derived from the solution.
       tranchePercentage must add up to 100; deliverableDueWeek ≤ durationWeeks  (else 422)
       trancheAmount = totalBudget × tranchePercentage / 100, computed server-side
  409  the proposal's eligibility is "ineligible" (detail names the failed rules; "pending" is allowed)
  409  a pilot already exists for this proposal (one pilot per solution)
  effects, in one transaction: pilot created with status Approved (history records
       proposed → under_review → approved by the officer), the solution → shortlisted,
       the problem → pilot_active. start_date = today.
GET   /api/pilots                     any logged-in user → 200 Pilot[]  newest first  (api.ts getPilots)
GET   /api/pilots/:idOrCode           any logged-in user → 200 Pilot                   (api.ts getPilot)
PATCH /api/pilots/:idOrCode/status    the officer who posted the problem → 200 Pilot   (api.ts updatePilotStatus)
  in:  { status }   a PilotStatus label; only legal moves (§3), else 400
       Approved → Active re-dates the pilot to start today (milestone due weeks are kept)
       Recommended for procurement → Procured also writes the procurement records (Module 9),
       in the same transaction
POST  /api/pilots/:idOrCode/audit     government roles → 204   (api.ts logAuditEntry)
  in:  { action, actorName?, actorRole?, hash? }   actorName/actorRole default to the caller's
       stored in audit_entries with recorded_by = the caller. Free-form notes: status changes are
       already in pilot_status_history.
```
`PATCH /api/solutions/:id/status` to `shortlisted` gets the same ineligible → 409 check.

### Milestones & tranches (Module 5 + old Module 7, now merged)
`payment_tranches` no longer exists as a separate resource — tranche amount, percentage,
disbursed flag and disbursed timestamp live directly on the milestone
(`pilot_milestones` table), matching `frontend/lib/types.ts` `Milestone`.
`deliverableDueWeek` = `(due_date − pilot start_date) / 7`; `deliverableFileUrl` = `evidence_url`.
All three return the whole updated `Pilot`, and all need the pilot to be **Active** (else 400).
```
PATCH /api/pilots/:pilotId/milestones/:milestoneId/deliverable     the pilot's startup only
  in:  { achievedKPI, fileUrl }        (api.ts submitMilestoneDeliverable)
  -- pending | failed | submitted → submitted; clears any prior verification stamp; verified → 400

PATCH /api/pilots/:pilotId/milestones/:milestoneId/verify          the officer who posted the problem, or any evaluator
  in:  { verifiedBy, remarks, status: "verified" | "failed", verificationReportUrl? }   (api.ts verifyMilestone)
  -- only a submitted milestone (else 400)
  -- 403 if the caller saved a rubric on this solution (conflict of interest: the validator
     must differ from the proposal's evaluator)
  -- stamps verified_by (the caller's account), verified_by_name (verifiedBy), verified_at
  -- verified: the tranche is disbursed (tranche_disbursed = true, disbursed_at = now());
     when every milestone is verified the pilot moves to Completed automatically
  -- failed: pilots.failed_milestones_count += 1

PATCH /api/pilots/:pilotId/milestones/:milestoneId/disburse        the officer who posted the problem
  -- verified milestones only (else 400); a no-op if verification already disbursed it   (api.ts disburseTranche)
```

### IP / Data agreements, KPIs, independent validation (cross-cutting) — deferred
Tables (`ip_agreements`, `kpi_logs`, `validations`) exist in `schema.sql` but **no
endpoints are planned yet** — nothing in the frontend calls them (checked again when the
Procure/Scale stages were built). Milestone verification already covers independent validation.
Build these last, after everything the frontend actually uses is working. Sketch,
for when we get there:
```
POST  /api/pilots/:id/ip-agreement    { ip_clause_type, data_sharing_terms, cybersecurity_clause, risk_clause }
PATCH /api/ip-agreements/:id/sign     { signed_by }  -- 'startup' | 'dept'
POST  /api/pilots/:id/kpi             { metric_name, target_value, actual_value }
GET   /api/pilots/:id/kpi
POST  /api/pilots/:id/validate        { outcome, notes }   -- validator must != the evaluator on this solution
```

### Procurement (Module 9)
There's no procurement endpoint of its own: the officer who posted the problem moves the pilot
Completed → Recommended for procurement → Procured with `PATCH /api/pilots/:id/status`. The move
to Procured writes, in one transaction with the status change and its history row:
- a `procurement_records` row: `status = 'issued'`, `procured_at = now()`, and a `compliance_checklist`
  snapshot `{ eligibility_status, milestones_total, milestones_verified, all_milestones_verified,
  failed_verifications, rubric_total, performance_score }`
- a `proven_solutions` row pointing at it. The pilot is now listed under Scale.

One procurement per pilot and one proven solution per procurement (UNIQUE in `schema.sql`).
`procurement_package_url` stays NULL: nothing generates a package yet.

### Scale (Module 10)
```
GET   /api/proven-solutions              any logged-in user → 200 ScaleSolution[]  newest procurement first
                                         (api.ts getScaleSolutions)
GET   /api/replications                  any logged-in user → 200 ReplicationRequest[]  newest first
                                         (api.ts getReplications) — a startup sees only requests for its own solutions
POST  /api/replications                  govt_officer → 201 ReplicationRequest   (api.ts createReplicationRequest)
  in:  { pilotId, requestingOfficerName, requestingOfficerEmail, targetDeploymentSite,
         targetQuantity, targetBudget?, deploymentTimelineWeeks? }
       pilotId: the proven solution's pilot, id or code (= ScaleSolution.id)
       other ReplicationRequest fields api.ts sends are ignored (joined at read time)
  403  the officer who ran the originating pilot (requests come from other departments)
  404  the pilot isn't procured
  409  the same officer already has an open (pending/approved) request for this solution
  also increments proven_solutions.replication_requests_count, same transaction
PATCH /api/replications/:id/status       govt_officer → 200 ReplicationRequest   (api.ts updateReplicationStatus)
  in:  { status }   pending → approved: only the officer who ran the originating pilot
                    approved → in_pilot: only the officer who made the request
                    any other move → 400; in_pilot is final
```
`ScaleSolution` from `frontend/lib/types.ts`:
- `id` is the **pilot's** id (so a replication's `pilotId` is `scaleSolution.id`), `pilotCode` its code.
- `title` = the solution title, `summary` = its ML summary (or abstract), `domain` /
  `originatingDepartment` from the problem, `validationDate` = `procured_at`.
- `performanceScore` as on `Pilot`; `totalBudget` = the pilot budget.
- `deployedUnits` = 1 (the original pilot) + replication requests that reached `in_pilot`.
- `budgetPerUnit` = the pilot budget per deployment, formatted like `₹23,00,000`.
- `gfrExemptionClause` is a constant: `GFR 2017 Rule 194 (startup innovation procurement)`.

`replication_requests` stays normalized. `solutionTitle`, `startupName`, `originatingDepartment`,
and `requestingDepartment` in the responses are **not** stored columns — the API layer fills them
in via joins at read time:
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
proposed -> under_review -> approved -> active -> completed -> recommended_for_procurement -> procured
                                            |
                                            -> failed
```

No other transitions are valid. Invalid `PATCH /pilots/:id/status` calls get a 400 whose
detail names the allowed next statuses. `completed` also needs every milestone verified.
`failed` and `procured` are final. The table lives in `app/services/pilot_state_machine.py`
(`TRANSITIONS`), with a copy in `frontend/lib/pilotStateMachine.ts` for the UI.
Every change, including the automatic ones, is written to `pilot_status_history`
(`from_status`, `to_status`, `changed_by`, `changed_at`).

Milestone status is a separate, unrelated state machine:
`pending -> submitted -> verified | failed`, `failed -> submitted` (resubmission); `verified` is final.

---

## 4. Build priority

1. Everything `frontend/lib/api.ts` calls: auth, problems, solutions (+ automatic
   eligibility check + ML summarize/rank on submission), pilots, milestones/tranches,
   rubric scoring, scale/replication.
2. The eligibility rule engine specifically — build it alongside solution submission,
   not after.
3. IP agreements, KPI logs, independent validations — tables only for now, endpoints later
   once the frontend grows UI for them.
