# SAMARTH: 5-minute demo script

The demo walks one procurement lifecycle through **Identify → Pilot → Procure → Scale**,
using the seeded demo data plus a few live actions.

## Before you start

1. Start the ML service, backend and frontend (see `RUNNING.md`).
2. Reset the demo data. The demo changes it, so do this before every rehearsal:
   `cd backend` → `python seed.py --reset --yes`
3. Have a small text PDF ready (any 1–2 page proposal) for the submission step.
4. Switch accounts with the persona buttons in the header. Every password is `Samarth@2026`.

Accounts used:

| Short name     | Login                        | Role                                  |
|----------------|------------------------------|---------------------------------------|
| MandiMitra     | `mandimitra@samarth.demo`    | Startup                               |
| Agri officer   | `officer.agri@samarth.demo`  | Govt officer (Agriculture), owns P1/P2 |
| Evaluator      | `evaluator@samarth.demo`     | Independent evaluator                 |
| Urban officer  | `officer.urban@samarth.demo` | Govt officer (Urban Affairs)          |

---

## The click-through

| # | Time | Account | Where | Do / say |
|---|------|---------|-------|----------|
| 1 | 0:00 | **MandiMitra** | Startup → Profile | Show the DPIIT number, turnover band and the **ML-extracted tags and skills** from the uploaded pitch deck. *"The startup uploads its documents once, and the ML service reads its domain and capabilities out of the PDF."* |
| 2 | 0:35 | **Agri officer** | Gov → Problems → **Post New Problem Statement** | Publish a short AgriTech challenge (for example, FPO market price advisory) with target TRL-5. *"A department posts its problem publicly, with a TRL requirement and a deadline."* |
| 3 | 1:05 | **MandiMitra** | Startup → Problems → the new challenge | Fill in the proposal (TRL-5, cost, weeks), attach the PDF, then **Submit Technical Proposal**. *"When it's submitted, the ML service summarises it and the eligibility engine runs straight away."* |
| 4 | 1:35 | **Agri officer** | Gov → Problems → **P1 (paddy pests)** → shortlist | Show the three proposals **ranked by AI match score**, each with its matched keywords and explanation. Open **MandiMitra's** P1 proposal: eligibility is **ineligible** (TRL-5 claimed, TRL-6 required), so it can't be shortlisted. |
| 5 | 2:10 | **Evaluator** | Gov → Problems → P1 → **BhoomiSense's** proposal | Score the rubric (technical merit /30, cost realism /20, team /20, timeline /30), then **Save Rubric Score**. *"The evaluator is separate from the officer. Whoever scores a proposal can't later verify its milestones, because that would be a conflict of interest."* |
| 6 | 2:45 | **Agri officer** | Gov → Pilots → **KrishiNetra's** pilot | This pilot is active. Milestone 1 is verified and its tranche is paid. Milestone 2 has been submitted, so click **Verify Deliverable & Authorize Tranche**. *"Money is released milestone by milestone, only after verification."* (The evaluator scored KrishiNetra, so the evaluator would get a 403 here.) |
| 7 | 3:25 | **Agri officer** | Gov → Pilots → **BhoomiSense's** pilot → **View Sanction Docket** | This pilot finished and was procured. Show the performance score and the sanction docket, which says it's eligible for direct sanction under GFR 194. *"Once a pilot succeeds, it goes straight to procurement without a fresh tender."* |
| 8 | 4:00 | **Urban officer** | Gov → Scale | BhoomiSense is now a **proven solution** that other departments can adopt. The Urban Affairs officer has a **pending replication request** on it. |
| 9 | 4:20 | **Agri officer** | Gov → Scale | **Approve** the replication request. Only the officer who ran the original pilot can approve it. |
| 10 | 4:40 | **Urban officer** | Gov → Scale | **Mark in pilot**. The deployed-units count goes up. *"One successful pilot in one department becomes a deployment in another."* |

KrishiNetra's pilot can't reach procurement in five minutes. Milestone 3 would still need
to be submitted and verified. That's why step 7 switches to BhoomiSense's pilot, which the
seed has already taken through to Procured.

---

## Likely judge questions

- **How does ranking work?** The ML service embeds the problem and each proposal with MiniLM and scores each proposal as 0.4 × fit with the problem description + 0.4 × fit with the desired outcome (adjusted for TRL distance) + 0.2 × title fit, using cosine similarity. KeyBERT supplies the matched keywords, and a TF-IDF fallback runs if the embedding models fail.
- **How does eligibility work?** Four rules run automatically on submission: a valid DPIIT number, turnover within ₹25 Cr, an ML-classified startup domain that matches the problem's domain, and a claimed TRL at or above the required TRL. Any failure makes the proposal ineligible, and ineligible proposals can't be shortlisted or piloted.
- **What's the performance score formula?** `100 × (0.4 × rubric/100 + 0.4 × verified/(verified + failed verifications) + 0.2 × on-time share of milestones)`. With no rubric it becomes 2/3 verification rate + 1/3 on-time share, and it isn't shown until at least one milestone is verified.
- **What happens if ML is down?** Nothing fails. Profiles, proposals and pilots save normally. Tags, summaries and match scores show as pending ("AI match analysis pending."), and the domain eligibility rule stays pending. **Re-run AI Ranking** or `python retry_ml.py` fills everything in once the ML service is back.
