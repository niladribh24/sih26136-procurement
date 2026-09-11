# SAMARTH (SIH26136) — Frontend Architecture, Routing & UI/UX Design Specification

## 1. Executive Summary

**SAMARTH** is a sovereign digital public innovation and procurement platform bridging startups and government departments. The platform facilitates a deterministic four-stage lifecycle:

```text
IDENTIFY  ──▶  PILOT  ──▶  PROCURE  ──▶  SCALE
```

This specification defines the frontend routing architecture, UI/UX screen specifications, role-based access control (RBAC) security boundaries, component hierarchy, and demo workflows for the Next.js frontend application, in strict conformance with `frontend/DESIGN.md` and `PROJECT_BREAKDOWN.md`.

---

## 2. Security Architecture & Strict RBAC Enforcement

The platform supports two primary user personas with distinct operational domains: **Startup** and **Government Officer** (including technical evaluators). To prevent any cross-role data leakage:

### 2.1 Edge Middleware Gate (`middleware.ts`)
- Next.js Edge Middleware inspects the incoming session token (JWT) on every request before component rendering or data hydration occurs.
- `/startup/*` routes strictly require the token to possess `role === 'startup'`. Non-startup users or unauthenticated visitors are immediately redirected to `/login?redirect=...`.
- `/gov/*` routes strictly require `role === 'govt_officer' | 'evaluator' | 'admin'`. Startup tokens attempting to access `/gov/*` receive a 403 Access Denied without hydrating internal government data.
- Public routes (`/`, `/login`, `/signup`) remain openly accessible.

### 2.2 True-Auth Demo Persona Switching
To facilitate seamless hackathon judging while strictly maintaining RBAC compliance:
- Pre-configured database profiles are mapped to 1-click selectable demo chips on the Gateway (`/`) and Login (`/login`) pages:
  - **Government Officer**: Dr. A. Sharma (Nodal Director, Department of Agricultural Research)
  - **Startup Founder**: Vikram Mehta (Founder & CEO, AeroKisan Technologies Pvt Ltd)
  - **Independent Evaluator**: Prof. K. Rao (Department of Aerospace, IIT Delhi)
- Selecting a demo persona automatically submits credentials against the real `/api/auth/login` endpoint.
- The backend issues a genuine signed JWT containing the persona's role and user ID.
- The frontend clears any existing client-side cache and re-navigates through `middleware.ts`, verifying full end-to-end security.

---

## 3. Route Map & File Tree

The Next.js App Router tree is structured as follows:

```text
frontend/app/
├── (marketing)/
│   └── page.tsx                         # Sovereign Gateway: Introduction, 4-stage lifecycle, 1-click launchpads
│
├── (auth)/
│   ├── layout.tsx                       # Centered paper card auth layout with SAMARTH branding
│   ├── login/page.tsx                   # Unified login with role tabs & clickable demo persona launchpads
│   └── signup/page.tsx                  # Registration form with role toggle (Startup vs Govt Officer)
│
├── (dashboard)/
│   │
│   ├── startup/                         # Guarded route group: role === 'startup'
│   │   ├── layout.tsx                   # Startup Portal Shell (Sidebar navigation, top header)
│   │   ├── profile/page.tsx             # DPIIT Profile, turnover band, PDF upload with interactive AI tag extraction
│   │   ├── problems/page.tsx            # Problem Browser: Search & filter open government challenges
│   │   ├── problems/[id]/page.tsx       # Split 2-Column View: Problem Specs (Left) + Technical Proposal Form (Right)
│   │   ├── proposals/page.tsx           # Track submitted proposals, review status & feedback
│   │   ├── pilots/page.tsx              # Active pilots listing
│   │   ├── pilots/[id]/page.tsx         # Pilot Workspace: State banner, deliverable proof upload, KPI logger, tranches
│   │   └── scale/page.tsx               # Proven Solutions Showcase (cross-department case studies & benchmarks)
│   │
│   └── gov/                             # Guarded route group: role === 'govt_officer' | 'evaluator'
│       ├── layout.tsx                   # Government Department Shell (Sidebar navigation, ministry seal)
│       ├── problems/page.tsx            # My Problems Register: Posted challenges, deadlines, submission counts
│       ├── problems/new/page.tsx        # Post a Problem: Structured intake form (domain, TRL, budget, outcomes)
│       ├── problems/[id]/shortlist/     # HERO SCREEN 1: Ranked Shortlist
│       │   └── page.tsx                 # AI similarity match cards, summaries, overlap chips, SolutionInspectorDrawer
│       ├── pilots/page.tsx              # Department Pilots Register across all lifecycle stages
│       ├── pilots/[id]/page.tsx         # HERO SCREEN 2: Pilot Tracker & Milestone State Machine
│       │                                # Linear state banner, milestone deliverable cards, Independent Validation Drawer
│       ├── pilots/[id]/procure/page.tsx # HERO SCREEN 3: Procurement Sanction Docket
│       │                                # Sanction order memo, GFR Rule 149 exemption, 1-click GeM simulation
│       └── scale/page.tsx               # HERO SCREEN 4: Scale & Proven Solutions Repository
│                                        # Cross-department repository with 'Request Inter-Department Replication' modal
```

---

## 4. Screen-by-Screen Detailed Specifications

### 4.1 Gateway Page (`/`)
- **Visual Aesthetic**: Civic Editorial. Warm parchment canvas (`#F4F2EB`), deep ink typography (`#161917`), and sovereign navy accents (`#1B365D`).
- **Hero Section**:
  - Emblem: Sovereign civic seal with "SAMARTH — Public Procurement & Startup Innovation Platform".
  - Headline: "Bridging Startup Innovation with Sovereign Procurement."
  - Subtitle: "From operational challenge discovery to milestone-verified public sanction in four transparent stages."
- **The 4-Stage Visual Walkthrough**:
  - `IDENTIFY`: Structured challenge posting & NLP-driven proposal matching with explainability.
  - `PILOT`: Time-boxed, milestone-driven field trials with independent evaluator sign-offs.
  - `PROCURE`: GFR Rule 149 compliant sanction dossiers simulating GeM-ready handover.
  - `SCALE`: Cross-department catalog enabling instant replication of proven innovations.
- **Evaluation Launchpad**: Two primary cards with 1-click entry into pre-seeded personas for immediate judging without manual credential entry.

---

### 4.2 Authentication (`/login` & `/signup`)
- **Login (`/login`)**:
  - Role switcher tab: `Startup Portal` vs `Government Department`.
  - Email & password inputs with keyboard validation.
  - Clickable "Quick Evaluation Personas" that auto-populate verified accounts and log in with genuine JWT tokens.
- **Signup (`/signup`)**:
  - Role toggle: `Startup Founder` vs `Government Nodal Officer`.
  - Organization / Ministry name, Official Email, Mobile, Password.
  - Startup-specific field: DPIIT Recognition Number (with format validation `DIPPXXXXX`).

---

### 4.3 Startup Dashboard Screens (`/startup/*`)

#### Profile & Capabilities (`/startup/profile`)
- **Metadata Card**: Startup entity name, DPIIT number, incorporation year, turnover band (`< ₹1 Cr`, `₹1–₹5 Cr`, `₹5–₹25 Cr`).
- **Past Project PDF Upload Zone**: Drag-and-drop PDF uploader.
- **NLP Tag Extraction Interface**:
  - Upon upload, calls NLP microservice `/extract`.
  - Displays auto-classified domain badge (e.g. `AgriTech`).
  - Displays extracted skill tags as interactive chips (e.g. `[ Computer Vision × ] [ Edge AI × ] [ Thermal Sensors × ]`).
  - Allows startup to delete incorrect tags or click `+ Add Skill` to manually append capabilities.
  - Save button persists tags to `startup_profiles` table.

#### Problem Browser (`/startup/problems`)
- Filter bar: Domain category, Budget band, Expected TRL level, Submission deadline.
- Challenge Cards:
  - Problem ID (`PRB-2026-081`) in `IBM Plex Mono`.
  - Title in `Newsreader` (e.g. "Canopy-Penetrating Drone Surveillance for Border Outposts").
  - Originating Department (e.g. "Department of Military Affairs").
  - Budget band (`₹25L–₹50L`) and Target TRL (`TRL-6+`).
  - "View Challenge & Submit Proposal" button navigating to `/startup/problems/[id]`.

#### Problem Detail & Proposal Submission (`/startup/problems/[id]`)
- **Split Two-Column Layout**:
  - **Left Column (Problem Specification)**:
    - Department name and contact nodal officer.
    - Operational problem narrative and current bottlenecks.
    - Required technical deliverables and acceptance criteria.
    - Budget range and time-frame.
  - **Right Column (Interactive Proposal Form)**:
    - Proposal Title & Executive Pitch Abstract.
    - Proposed TRL selector (`TRL-4` through `TRL-9`).
    - Proposed Cost (`₹`) and Deployment Timeline (weeks).
    - PDF Proposal upload zone.
    - "Submit Technical Proposal" button triggering background NLP `/summarize` and `/rank`, displaying a success confirmation with tracking ID `PROP-2026-XXXX`.

#### My Proposals (`/startup/proposals`)
- Register of all submitted proposals.
- Columns: Problem Title, Department, Date Submitted, Claimed TRL, Status badge (`Submitted`, `Under Review`, `Shortlisted for Pilot`, `Not Selected`).

#### My Pilots (`/startup/pilots` & `/startup/pilots/[id]`)
- **List (`/startup/pilots`)**: Cards for all active pilots showing overall progress bar, next milestone due date, and approved tranche total.
- **Detail (`/startup/pilots/[id]`)**:
  - Linear State Machine Banner (`Proposed → Under Review → Approved → Active → Completed`).
  - Current Active Milestone Card:
    - Milestone objective and target KPI benchmark.
    - "Upload Deliverable Proof" (PDF test report, video link, code repository).
    - "Log Achieved KPI" input field.
    - Tranche status banner: "Tranche 2 (₹6,00,000) — Pending Independent Verification".

---

### 4.4 Government Officer Dashboard Screens (`/gov/*`)

#### My Problems Register (`/gov/problems`)
- Table of posted departmental challenges.
- Displays: Problem ID, Title, Domain, Date Posted, Total Proposals Received, Current Status (`Open for Bidding`, `Evaluating Shortlist`, `Pilot Active`).
- CTA: "Post New Problem" button navigating to `/gov/problems/new`.

#### Post a Problem (`/gov/problems/new`)
- Structured form:
  - Challenge Title.
  - Department / Division.
  - Domain Category (AgriTech, Defence, HealthTech, GovTech, CleanTech).
  - Detailed Operational Challenge (context, existing constraints).
  - Target Deliverables & Acceptance Metrics.
  - Budget Band (`< ₹10L`, `₹10L–₹25L`, `₹25L–₹50L`, `> ₹50L`).
  - Target Minimum TRL (`TRL-4` through `TRL-8`).
  - Submission Deadline date picker.

---

### 4.5 HERO SCREEN 1: Ranked Shortlist & Solution Inspector (`/gov/problems/[id]/shortlist`)
- **Screen Purpose**: The flagship demonstration of AI-assisted, explainable procurement discovery.
- **Header**: Problem Title, Department, Total Proposals Submitted, NLP Ranking Status.
- **Ranked Solution Cards (Sorted Descending by Match Score)**:
  - Rank Badge: `#1`, `#2`, `#3`.
  - Startup Name & DPIIT Verification Badge (`[✓ DPIIT: DIPP98234]`).
  - Match Score Pill: Rendered in Warm Ochre (`--highlight`) (e.g. `92% Fit`).
  - Executive Abstract: 2–4 sentence NLP-extracted summary.
  - Keyword Overlap Signal Chips: Visual chips showing exact matching phrases (e.g. `[ multispectral sensing ] [ canopy inspection ] [ TRL-6 ]`).
  - Actions: "Inspect Proposal & Evidence" (opens drawer) and "Shortlist for Pilot".

#### `SolutionInspectorDrawer` (Slide-Out 540px Drawer):
1. **Side-by-Side Comparison**:
   - Problem Statement Technical Requirements vs Startup Proposal Technical Excerpts with keyword overlap highlights.
2. **Automated Eligibility Checks**:
   - `[✓]` DPIIT Number Verified via API
   - `[✓]` Annual Turnover within Ceiling (< ₹25 Cr)
   - `[✓]` Domain Alignment (AgriTech)
3. **Evaluator Rubric Panel**:
   - Technical Merit & Innovation (/30)
   - Cost Realism & Budget Alignment (/20)
   - Team Feasibility & Past Projects (/20)
   - Timeline Viability (/30)
   - Total Rubric Score: Calculated automatically.
4. **Approve & Configure Pilot Expansion Panel**:
   - Direct action inside drawer to transition candidate into Pilot:
   - Sets Pilot Duration (weeks).
   - Configures 2–3 milestones (deliverable description, KPI target benchmark, tranche disbursement %).
   - Assigns Independent Evaluator (validating conflict-of-interest rule: validator != proposal evaluator).
   - "Launch Pilot" CTA updates PostgreSQL state machine to `Proposed` and navigates to Hero Screen 2.

---

### 4.6 HERO SCREEN 2: Pilot Tracker & Milestone State Machine (`/gov/pilots/[id]`)
- **Screen Purpose**: Rigorous milestone governance, state machine enforcement, and independent verification audit trails.
- **Linear State Progression Banner**:
  ```text
  [✓] Proposed  ──▶  [✓] Under Review  ──▶  [✓] Approved  ──▶  [●] Active  ──▶  [ ] Done
  ```
  - Displays current stage, time elapsed (e.g. "Week 3 of 8"), and appointed Independent Validator.
  - Invalid state transitions are locked.
- **Milestone Deliverable Cards**:
  - Each milestone card displays:
    - Milestone Title & Objective.
    - Due Date and Payment Tranche Amount (`₹6,00,000 / 30%`).
    - KPI Target Benchmark vs Achieved KPI logged by startup.
    - Deliverable file attachment link.
  - **Independent Verification Action Drawer**:
    - Clicking "Verify Milestone" opens verification modal/drawer.
    - Checks that validator ID is independent.
    - Evaluation remarks input and Pass/Fail decision.
    - On Pass: Generates Tranche Release Authorization Memo with cryptographic audit stamp (`IBM Plex Mono`).
  - **Procurement Handoff Trigger**:
    - When final milestone is verified, the "Recommend for Procurement" button activates, advancing state to `Recommended for procurement` and linking to Hero Screen 3.

---

### 4.7 HERO SCREEN 3: Procurement Sanction Docket (`/gov/pilots/[id]/procure`)
- **Screen Purpose**: Conversion of verified pilot outcomes into an official, compliance-ready government procurement package (simulating GeM integration).
- **Layout**: Styled as an official sovereign Sanction Memorandum:
  1. Header: Sovereign Emblem, Department Sanction Order Reference, Date.
  2. Vendor Particulars: Startup legal name, DPIIT registration seal, MSME/UDYAM number, bank mandate details.
  3. Pilot Performance Audit: Problem statement reference, 8-week trial logs, milestone verification certificates, final trial score (`94.2/100`).
  4. Statutory Exemptions Applied:
     - GFR Rule 149 Exemption for Validated Innovation Pilot.
     - DPIIT Circular 2016 (Exemption from Prior Turnover and Prior Experience for Startups).
     - Conflict-of-Interest Declaration & Independent Validator Signature.
  5. Sanction Financials: Total procurement value, unit delivery schedule, warranty & maintenance terms.
- **Primary Actions**:
  - `[ Download Official Sanction Package (PDF) ]`
  - `[ Transmit to GeM Simulation Gateway ]` (marks pilot as `Procured` in DB).

---

### 4.8 HERO SCREEN 4: Scale & Proven Solutions Repository (`/gov/scale` & `/startup/scale`)
- **Screen Purpose**: Inter-departmental discovery and zero-friction replication of field-proven innovations across government ministries.
- **Catalogue Interface**:
  - Filterable by Domain, Originating Ministry, Deployment Scale, Pilot Rating.
  - Solution Cards:
    - Startup Name & Solution Title.
    - Originating Department: "Field Validated by Department of Agricultural Research".
    - Verified Trial Performance Metrics (e.g. "98.4% Weed Detection Accuracy under Monsoon Canopy").
    - Completed Sanction Date & Deployed Units.
- **Inter-Department Replication Flow**:
  - Clicking "Request Inter-Department Replication" opens the **Replication Modal**:
    - Replicating Department & Division name.
    - Target deployment location & estimated volume.
    - Direct adoption justification note citing originating ministry's sanction order.
    - "Submit Adoption Request" persists a new replication record to `replication_requests` table and alerts the startup.

---

## 5. Component Hierarchy & File Structure

```text
frontend/components/
├── ui/
│   ├── Button.tsx                   # Primary (Navy), Secondary (Paper), Highlight (Ochre), Danger
│   ├── Input.tsx                    # Accessible input with permanent label and error messaging
│   ├── Select.tsx                   # Custom styled dropdown select
│   ├── Dialog.tsx                   # Modal dialog primitive with backdrop
│   ├── Drawer.tsx                   # Slide-out inspection drawer (right-side 540px)
│   ├── Badge.tsx                    # DPIIT badges, status pills, TRL tags
│   └── Tabs.tsx                     # Role switcher and dashboard tabs
│
├── layout/
│   ├── AppShell.tsx                 # Shared dashboard shell with header and responsive sidebar
│   ├── Sidebar.tsx                  # Role-tailored navigation menu
│   ├── TopHeader.tsx                # Ministry/Department title, role badge, demo persona switcher
│   └── PageHeader.tsx               # Contextual page headline, problem ID, primary CTAs
│
├── data/
│   ├── DataTable.tsx                # Data grid for proposals, pilots, and replication records
│   ├── MetricCard.tsx               # Operational metric card with contextual indicators
│   ├── StatusBadge.tsx              # State machine visual indicators
│   └── AuditStamp.tsx               # Monospace audit trail metadata stamp
│
├── feedback/
│   ├── LoadingSkeleton.tsx          # Structured content loading placeholder
│   ├── EmptyState.tsx               # Clear empty state with contextual action buttons
│   └── Toast.tsx                    # Immediate feedback notification
│
└── domain/
    ├── StartupTagList.tsx           # Interactive AI-extracted capability chips with manual edit/add
    ├── RankedSolutionCard.tsx       # Shortlist card with match score %, abstract, and overlap chips
    ├── SolutionInspectorDrawer.tsx  # Side-by-side proposal review, eligibility check & rubric scoring
    ├── PilotSetupPanel.tsx          # In-drawer milestone duration, KPI, and tranche setup builder
    ├── MilestoneStepper.tsx         # Linear state machine progression banner
    ├── MilestoneCard.tsx            # Milestone deliverable status, KPI logging, and tranche amounts
    ├── IndependentValidationDrawer.tsx # Validator conflict-of-interest check and sign-off
    ├── SanctionDocketView.tsx       # Formal sovereign sanction memo layout with GFR exemptions
    └── ReplicationModal.tsx         # Cross-department adoption request form
```

---

## 6. Implementation Readiness & Compliance Checklist

- [x] Strict RBAC security boundaries enforced at Edge via `middleware.ts`.
- [x] Zero data/info leakage between Startup and Government roles.
- [x] True-auth Demo Persona switching for frictionless hackathon judging.
- [x] All visual specifications strictly align with `frontend/DESIGN.md` (Civic Editorial palette, IBM Plex typography, no AI slop).
- [x] Full coverage of all 4 stages: `IDENTIFY`, `PILOT`, `PROCURE`, `SCALE`.
