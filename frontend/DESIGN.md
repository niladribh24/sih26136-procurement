# DESIGN.md

# SAMARTH
## Frontend Design Constitution

> **This file is the single source of truth for frontend design across the SAMARTH platform.**
>
> Every AI coding agent and every developer working on the frontend MUST read this file before creating or modifying UI.
>
> Do not invent a second visual language.
>
> Do not fall back to component-library defaults.
>
> Do not interpret "premium", "modern", or "beautiful" as permission to improvise.
>
> **If a design decision is not defined here, choose the option that best preserves the principles in this document.**

---

# 00. DESIGN NORTH STAR

SAMARTH (SIH26136) bridges the gap between agile, innovative startups and government public procurement. The platform accompanies startups and department officers through four rigorous stages:

```text
IDENTIFY  ──▶  PILOT  ──▶  PROCURE  ──▶  SCALE
```

The product should feel like it was designed by a small, exceptionally disciplined product-design team building sovereign digital public infrastructure.

It should feel:

- institutional yet modern
- calm and authoritative
- intelligent and transparent
- human and accessible
- trustworthy and verifiable
- purposeful
- editorial
- tactile
- operationally excellent
- quietly distinctive

It should **not** feel:

- futuristic for the sake of being futuristic
- like an AI showcase or demo toy
- like a SaaS marketing template
- like an unstyled component library
- like a Dribbble mockup unsuited for actual administration
- like a cluttered government portal from 2009
- like a pitch deck converted into HTML

### The governing principle

**The interface is a tool for people doing consequential public work.**

SAMARTH's users are:

- **Startup Founders & Bidding Teams** submitting technical innovations and seeking public contracts
- **Government Department Officers & Nodal Directors** posting operational challenges and evaluating trials
- **Independent Technical Evaluators** scoring solutions against rigorous rubrics
- **Procurement & Finance Officers** approving milestone tranches and generating sanction orders
- **Replication Officers from Other Ministries** seeking field-proven innovations to scale

Their attention is valuable. Public funds and startup survival depend on clarity and operational correctness.

Do not spend user attention on decorative excess.

---

# 01. THE DESIGN LANGUAGE

## Civic Editorial

The visual language combines:

**editorial typography**
+
**precise product UI**
+
**warm physical materials & sovereign authority**
+
**restrained data visualization & explainable AI**
+
**subtle tactile motion**

The result should feel closer to an authoritative, beautifully bound sovereign gazette and precision administrative instrument than to an ordinary silicon-valley SaaS dashboard.

### Three qualities must coexist

### 1. Dignified & Human

Use warm neutral paper textures, thoughtful copy, authentic documentation, and institutional dignity without bureaucratic coldness.

### 2. Precise & Verifiable

Use rigid grids, alignment, typographic hierarchy, consistent spacing, and predictable audit trails.

### 3. Alive & Responsive

The interface must respond to user actions with subtle motion, deterministic state machine feedback, and transparent system reasoning.

None of these qualities should overpower the others.

---

# 02. ANTI-AI-SLOP PRINCIPLE

## AI must never choose the aesthetic by default.

SAMARTH employs real NLP pipelines (zero-shot classification, embeddings, summarization, and cosine similarity ranking). Because AI is at the core of the **Identify** stage, it is doubly critical that the interface does **not** look like a generic "AI-powered" template.

The following patterns are strictly forbidden:

- purple/blue gradient backgrounds
- dark backgrounds with neon accents
- emerald-on-black "terminal AI" interfaces
- glowing radial orbs or floating background blobs
- sparkling magic wand icons (✨) used as interface decoration
- giant centered hero banners with empty hype
- pill-shaped eyebrow tags on every heading
- oversized gradient typography
- three identical floating feature cards
- glassmorphism and frosted blurry panels used as default containers
- excessive cards inside cards inside cards
- colored left borders on cards
- fake testimonials or fake metrics
- generic copy: "Empower", "Revolutionize", "Transform", "Unlock", "Seamlessly"
- random scroll-triggered staggered fade-up animations
- uncalibrated monospace fonts used purely for "tech" aesthetics

When SAMARTH displays AI results (such as matching scores or keyword overlaps), it presents them as **transparent empirical evidence**:

```text
Match Score: 88%
Matching Domain: AgriTech / Drone Imaging
Key Term Overlap: [ multispectral sensing ] [ canopy inspection ] [ TRL-6 ]
Summary: 2-3 sentence deterministic abstract extracted from proposal PDF.
```

No glowing orbs. No magic. Just clear, explainable data.

---

# 03. PURPOSE GATE

Every non-trivial visual technique must serve a concrete purpose.

Before introducing a visual element, verify which of these it serves:

1. hierarchy
2. grouping
3. navigation
4. comprehension
5. feedback
6. emphasis
7. interaction
8. orientation
9. trust & auditability
10. institutional context
11. accessibility

If it serves none of these, **do not introduce it**.

---

# 04. VISUAL PERSONALITY

The product must have a recognizable visual fingerprint without relying on superficial tricks.

Personality comes from:

- authoritative editorial typography (Newsreader paired with IBM Plex Sans)
- disciplined proportions and comfortable density
- sovereign navy accents combined with warm ochre highlights
- editorial composition of problem statements and solution abstracts
- tactile borders and crisp data tables
- purposeful micro-interactions on milestone transitions
- clean, professional administrative language

---

# 05. COLOR SYSTEM

## Base

The interface is built on a warm neutral foundation rather than sterile stark white or artificial dark-mode neon.

```css
:root {
  /* Surfaces & Canvas */
  --canvas: #F4F2EB;          /* Warm government parchment / canvas */
  --surface: #FAF8F3;         /* Primary surface / container */
  --surface-raised: #FFFFFF;  /* Elevated cards, modals, sheets */
  --surface-subtle: #EBE8DF;  /* Muted secondary backgrounds, table headers */

  /* Ink & Typography */
  --ink: #161917;             /* Primary deep ink */
  --ink-secondary: #474B46;   /* Secondary descriptive text */
  --ink-muted: #6E726A;       /* Captions, labels, timestamps */
  --ink-faint: #989C94;       /* Disabled controls, subtle rules */

  /* Structural Lines & Dividers */
  --line: #D9D6CB;            /* Primary border lines */
  --line-strong: #BEBBB0;     /* Active borders, table dividers */

  /* Primary Civic Accent — Sovereign Navy */
  --accent: #1B365D;          /* Sovereign Navy: primary actions, active tabs */
  --accent-hover: #122644;    /* Pressed/hover navy */
  --accent-soft: #E7EDF5;     /* Tinted button background, role badges */

  /* Highlight Accent — Warm Ochre / Amber */
  --highlight: #A25722;       /* AI match scores, key phrase highlights, alert tags */
  --highlight-hover: #864417;
  --highlight-soft: #F9EFE6;  /* Highlight containers, matched keyword chips */

  /* Semantic Feedback */
  --positive: #265C42;        /* Approved, DPIIT verified, milestone completed */
  --positive-soft: #E1EFE7;

  --warning: #8F5E1E;         /* Under review, pending evaluation, milestone due */
  --warning-soft: #F5ECD8;

  --danger: #963833;          /* Ineligible, milestone failed, contract terminated */
  --danger-soft: #F5E3E1;

  --info: #355872;            /* System audit notices, procurement dockets */
  --info-soft: #E0EBF2;
}
```

## Color philosophy

The interface is predominantly:

- warm neutral parchment
- deep ink
- sovereign navy
- warm ochre highlights

Color must feel **material and official**, like fine stationery and government seals, never synthetic.

### Sovereign Navy (`--accent`)
Use for:
- primary action buttons ("Post Problem", "Submit Proposal", "Approve Pilot")
- selected navigation states
- key links and active filters

### Warm Ochre (`--highlight`)
Use for:
- AI semantic match percentage badges (`88% Match`)
- highlighted matched phrases in solution abstracts
- TRL indicators and key capability chips

Do not paint entire pages in accent color.

---

# 06. COLOR PROHIBITIONS

Do not use:

- purple or violet gradients
- neon cyan or emerald-on-black glows
- pastel candy counters
- fluorescent tags
- rainbow status chips

If domain-specific problem statements use category colors (e.g. AgriTech vs. HealthTech vs. CleanTech), use muted, earth-grounded tones that harmonize with `--canvas`.

---

# 07. TYPOGRAPHY

Typography is the core of the SAMARTH visual identity.

## Primary typeface
**IBM Plex Sans**

Use for:
- navigation and top bars
- buttons and interactive controls
- forms, inputs, and validation feedback
- tables and data grids
- standard body copy and descriptions
- status chips and labels

## Editorial typeface
**Newsreader**

Use with purpose for:
- problem statement titles ("Autonomous Weed Detection for Precision Agriculture")
- hero screen page titles and procurement docket headers
- startup mission summaries and executive abstracts
- empty state narrative guidance
- official sanction order document view headers

## Technical / Data typeface
**IBM Plex Mono**

Use strictly where tabular alignment or code precision matters:
- Tender & Problem IDs (e.g. `PRB-2026-081`)
- DPIIT Recognition Numbers (e.g. `DIPP98234`)
- Milestone IDs, transaction hashes, and audit timestamps
- Currency values and budget bands (e.g. `₹15,00,000`)
- TRL numbers (`TRL-6`) and mathematical match scores (`0.8842`)

---

# 08. TYPE SCALE

```text
Display       48 / 56   (Editorial titles, public hero moments)
Page title    32 / 40   (Dashboard top titles, docket headlines)
Section       22 / 30   (Section headers, problem group titles)
Subsection    16 / 24   (Card titles, milestone names)
Body          14 / 22   (Default interface body text, form fields)
Small         12 / 18   (Metadata, table cells, secondary descriptions)
Micro         10 / 14   (Mono tags, DPIIT labels, timestamp captions)
```

Establish hierarchy through font weight, size, spacing, and placement—not through aggressive colors or all-caps.

---

# 09. TYPOGRAPHIC CHARACTER

Avoid:

```text
ALL-CAPS HEADINGS EVERYWHERE
```

Avoid:

```text
tiny purple eyebrow
MASSIVE GRADIENT BANNER
```

Avoid highlighting words arbitrarily. Highlights must correspond directly to actual matching criteria extracted by the NLP engine.

---

# 10. SPACING SYSTEM

Base unit: **4px**

Preferred values:
`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`

### Density
Administrative workflows require **high clarity at medium-high density**.
Officers must be able to scan 10 proposals, compare milestones, and evaluate rubrics without excessive scrolling. Do not introduce massive empty voids to simulate luxury consumer websites.

---

# 11. GRID

Desktop (12 columns):
- Left Navigation Sidebar: 240px fixed or 2 columns
- Main Operational Canvas: Remaining 10 columns (with max-width 1440px for large monitors)
- Right Inspection Drawer: 480px–560px contextual slide-out for solution inspection and rubric scoring

Tablet: 8 columns, collapsible navigation
Mobile: 4 columns, single-purpose stacked views

---

# 12. LAYOUT PHILOSOPHY

Prefer **hierarchical composition** over repetitive card grids.

When an officer opens a Problem Statement, the screen must visually prioritize:
1. The Problem Overview & Key Constraints (Title, Ministry, Budget, TRL)
2. The Top Ranked Solution Candidates (Sorted by AI Match Score)
3. The Actionable Next Step (Shortlist for Pilot or Reject)

Do not dump 12 equally sized cards on screen. Give the primary candidate and the primary action visual precedence.

---

# 13. APPLICATION SHELL

## Dual-Role Architecture: One App, Two Dashboards

Users log in as either **Startup** or **Government Officer**. The shell adjusts navigation accordingly.

```text
┌─────────────────┬─────────────────────────────────────────────────────────┐
│ SAMARTH         │ [Ministry of Defence / Startup Hub]    [Role: Govt] (V) │
├─────────────────┼─────────────────────────────────────────────────────────┤
│ ❖ Dashboard     │                                                         │
│ 📋 Problems     │                   OPERATIONAL WORKSPACE                 │
│ 🎯 Shortlists   │                                                         │
│ ⏱ Pilots (4)   │                                                         │
│ 📜 Sanctions    │                                                         │
│ 🌐 Scale Repository                                                       │
└─────────────────┴─────────────────────────────────────────────────────────┘
```

### Sidebar Navigation
- Crisp, quiet, high contrast.
- Active items use `--accent-soft` background with `--accent` text and a 3px solid `--accent` left indicator.
- Counts/badges (e.g. `New (3)`) use muted pill containers.

---

# 14. PAGE HEADER

Standard page headers must establish immediate operational context:

```text
Problem Statement #PRB-2026-081
Canopy-Penetrating Drone Surveillance for Border Outposts
Department of Military Affairs · Budget: ₹25L–₹50L · TRL: 6+

[ Review Shortlist (8) ]   [ Post Milestone Update ]   [ Export Docket ]
```

Avoid vague marketing headlines. Be specific, operational, and direct.

---

# 15. CARDS & SURFACES

Cards are functional grouping containers, not arbitrary decoration.

### Standard Container
```css
background: var(--surface-raised);
border: 1px solid var(--line);
border-radius: 8px;
box-shadow: none;
```

### Radius Tokens
- `2px`: Mono badges, DPIIT tags, status chips
- `6px`: Buttons, text inputs, dropdown selects
- `8px`: Standard cards, table containers, milestone boxes
- `12px`: Modals, inspection drawers, sanction dockets

Do not use 24px+ giant rounded corners. Keep corners crisp and structured.

---

# 16. DEPTH & SHADOWS

Depth is achieved through borders (`--line`) and surface tonal contrast (`--canvas` vs `--surface` vs `--surface-raised`), not heavy shadows.

Shadows are permitted only for:
- Slide-out contextual drawers (Solution Inspector)
- Modal dialogs (Replication Request modal)
- Floating dropdowns and filter menus

Do not apply drop-shadows to every card on the dashboard.

---

# 17. BUTTONS

Buttons must have unequivocal visual hierarchy:

- **Primary (`--accent`)**: Sovereign Navy with white text. Reserved for the single most consequential action on a screen ("Approve Pilot", "Submit Proposal", "Generate Sanction Package").
- **Secondary**: `--surface-raised` with `--line` border and `--ink` text. Used for supporting actions ("Inspect Proposal", "Download PDF", "Save Draft").
- **Highlight Action (`--highlight`)**: Warm Ochre with white text. Used for high-value AI actions ("Run Re-Ranking", "Extract Document Tags").
- **Destructive (`--danger`)**: Dark crimson with soft tinted background. Used for irreversible actions ("Terminate Pilot", "Reject Proposal").

Interaction: Subtle background color transition (150ms). No bouncy animations.

---

# 18. FORMS

Forms represent the formal administrative intake of the platform:
- Startup Profile & Document Upload
- Department Problem Creation
- Solution Proposal Submission
- Evaluator Rubric Entry
- Milestone Tranche Reporting

Rules:
- Visible, permanent labels (never rely on placeholder text alone).
- Currency inputs must clearly prefix the Indian Rupee symbol (`₹`).
- TRL inputs should use a dedicated structured radio or stepper selector (TRL-1 through TRL-9) with brief explanations.
- File upload targets must provide immediate feedback on file name, file size, and upload progress, followed by extracted tag previews.

---

# 19. DATA TABLES

Data tables are essential for comparing proposals, tracking milestones, and browsing procurement registers.

Table requirements:
- Fixed header with `--surface-subtle` background.
- Right-aligned numbers, currency, and dates.
- Monospace font for IDs, DPIIT codes, and scores.
- Subtle row hover (`background: var(--surface)`).
- Clickable rows must navigate to the appropriate inspection drawer or detail page.
- Avoid multi-colored zebra stripes; use crisp 1px borders.

---

# 20. METRICS & OPERATIONAL TELEMETRY

Metrics must tell an operational story. Every metric card must answer: *What is happening, and what requires my action?*

Preferred format:
```text
┌─────────────────────────────────┐
│ Active Pilots in Progress       │
│ 4                               │
│ 2 milestones due this week      │
└─────────────────────────────────┘
```

Never include generic vanity numbers ("10,000+ Startups Empowered!"). Present only verifiable facts from the database.

---

# 21. ICONOGRAPHY

- Use a single icon family (`lucide-react`).
- Maintain consistent stroke width (`1.75px` or `2px`).
- Use icons strictly to clarify actions or status (e.g. file attachment, calendar date, external link).
- Never place icons beside every word or heading as mere decoration.

---

# 22. EMOJI

**Strict prohibition:** Do not use emoji in the application UI, button labels, navigation, or status badges.
- Bad: `🚀 Launch Pilot`, `💡 New Problem`, `🔥 Top Match`
- Good: `Launch Pilot`, `New Problem`, `Top Match (88%)`

---

# 23. MOTION LANGUAGE

Motion in SAMARTH must be **quick, quiet, and precise**.

- Micro-interactions (button presses, chip toggles): `120ms`
- Status transitions and accordion expansions: `180ms`
- Slide-out drawers and modal reveals: `240ms`

Never use springy or bouncy animations. The system must feel stable and responsive.

---

# 24. EMPTY STATES

Empty states must explain what is missing and provide an immediate action:

```text
No Proposals Submitted Yet

This problem statement was published on 10 Sept 2026.
Once startups submit proposals, AI match ranking and extracted abstracts will appear here.

[ Share Problem Link ]   [ Edit Specifications ]
```

---

# 25. ERROR & SUCCESS STATES

- Errors must specify the exact validation failure and corrective action (e.g. "Proposal PDF exceeds 15MB limit. Please compress and re-upload.").
- Success must be immediate and proportionate: an inline banner or toast notification (e.g. "Milestone 2 marked verified. Tranche release memo generated."). No celebratory confetti or fireworks.

---

# 26. AI INTERACTION & EXPLAINABILITY

SAMARTH’s NLP engine performs three distinct operations:
1. **Startup Profiling (`/extract`)**: Extracts technical skills and tags from past project PDFs.
2. **Proposal Summarization (`/summarize`)**: Synthesizes 2–4 sentence executive abstracts from submitted solution PDFs.
3. **Problem Matching & Ranking (`/rank`)**: Calculates cosine similarity between department problem statements and startup solutions.

### Presentation Principles
- **Editable AI Tags**: When tags are extracted from a startup's uploaded project document, display them as interactive chips with an option to remove incorrect tags or manually add missing ones.
- **Match Score Presentation**: Express similarity scores clearly as percentages (`88% Fit`) alongside qualitative match explanations.
- **Phrase Overlap Highlighting**: Highlight key phrases in the solution abstract that directly drove the match score (e.g. `<mark class="match-highlight">autonomous navigation</mark>`).
- **No Mystery**: Always provide a link or drawer to inspect the raw submitted PDF text so officers can verify the AI's claims.

---

# 27. THE FOUR-STAGE LIFECYCLE SCREENS

SAMARTH is organized around the four sequential stages:

```text
IDENTIFY  ──▶  PILOT  ──▶  PROCURE  ──▶  SCALE
```

---

## Stage 1: IDENTIFY

### 1.1 Startup Profile & Capability Extraction
- Startup enters DPIIT registration number, annual turnover band, and company profile.
- Uploads past project / capability PDF.
- The UI triggers NLP `/extract` and presents extracted domain classification and skills tags:
  ```text
  Auto-Extracted Tags:
  [ AgriTech × ] [ Computer Vision × ] [ Edge AI × ] [ + Add Skill ]
  ```
- Startup can review and correct any inaccurate tag before saving.

### 1.2 Problem Browser (Startup View)
- Searchable, filterable catalogue of open department problem statements.
- Filter by: Domain (AgriTech, GovTech, Defence, HealthTech), Budget Band, Target TRL, Application Deadline.

### 1.3 Solution Submission Form (Startup View)
- Problem selection summary card.
- Structured form: Executive Pitch Abstract, Proposed TRL, Implementation Timeline (weeks), Cost Estimate.
- PDF proposal attachment upload.

### 1.4 Post a Problem (Government View)
- Structured intake form:
  - Title & Department/Ministry
  - Domain Category
  - Operational Problem Description & Current Bottlenecks
  - Desired Technical Outcome & Acceptance Criteria
  - Target Budget Band & Expected Minimum TRL

---

## HERO SCREEN 1: Ranked Shortlist & Solution Inspector

The **Ranked Shortlist** is the flagship demonstration screen for the **Identify** stage.

### Visual Layout
The screen presents all submitted solutions sorted in descending order of AI match score.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Ranked Solutions for #PRB-2026-081                                                     │
│ 6 proposals submitted · Evaluated via NLP Semantic Matcher                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ #1  AeroKisan Technologies                                       [ 92% Match ]     │ │
│ │     DPIIT-VERIFIED · Bengaluru · TRL-6 · Proposed Cost: ₹18.5L                     │ │
│ │                                                                                    │ │
│ │     Executive Abstract:                                                            │ │
│ │     Autonomous hexacopter equipped with multispectral optical sensors and onboard  │ │
│ │     edge compute capable of real-time canopy penetration and NDVI pest mapping.    │ │
│ │                                                                                    │ │
│ │     Key Overlap Signals:                                                           │ │
│ │     [ multispectral imaging ] [ edge compute ] [ real-time canopy mapping ]        │ │
│ │                                                                                    │ │
│ │     [ Inspect Proposal & Evidence → ]                     [ Shortlist for Pilot ]  │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                        │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ #2  Drishti Vision Labs                                         [ 84% Match ]     │ │
│ │     DPIIT-VERIFIED · Hyderabad · TRL-5 · Proposed Cost: ₹22.0L                     │ │
│ │     ...                                                                            │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Solution Inspector Drawer
Clicking "Inspect Proposal & Evidence" slides out a 540px right-hand inspection drawer:
- **Left/Top**: Problem Statement Requirements excerpt.
- **Right/Bottom**: Startup Proposal Excerpt with matching phrases highlighted in `--highlight-soft`.
- **Eligibility Checklist**: Boolean checks (DPIIT Verified? Turnover within band? Domain matched?).
- **Evaluator Rubric Panel**: Scoring fields (Technical Feasibility /30, Cost Realism /20, Team Capability /20, Timeline /30).

---

## Stage 2: PILOT

## HERO SCREEN 2: Pilot Tracker & Milestone State Machine

Once a solution is shortlisted and approved, it transitions into a structured, time-boxed Pilot.

### State Machine Progression Banner
At the top of the Pilot page, a strict linear state banner displays the current lifecycle stage:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [✓] Proposed  ──▶  [✓] Under Review  ──▶  [✓] Approved  ──▶  [●] Active  ──▶  [ ] Done │
│ Current Stage: ACTIVE PILOT (Week 4 of 8)                                              │
│ Lead Officer: Dr. A. Sharma (DMA) · Independent Evaluator: Prof. K. Rao (IIT Delhi)   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

Rules:
- Status transitions must follow the strict machine: `Proposed` → `Under review` → `Approved` → `Active` → `Completed/Failed` → `Recommended for procurement`.
- The frontend must reject or disable invalid status jumps.

### Milestone Deliverable Cards
Each pilot contains 2 to 4 time-boxed milestones:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Milestone 2: Sensor Calibration & Field Flight Test                          [ACTIVE]  │
│ Deliverable Due: 18 Oct 2026 · Payment Tranche: ₹6,00,000 (30%)                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Target KPI: False-positive detection rate < 8% under cloudy canopy conditions          │
│ Achieved KPI: 5.4% (Logged by Startup on 15 Oct)                                       │
│ Attached Deliverable: Flight_Log_Test_Run_04.pdf (4.2 MB)                              │
│                                                                                        │
│ Conflict of Interest Guard:                                                            │
│ Validation must be recorded by an Independent Evaluator (different from proposal scorer)│
│                                                                                        │
│ [ Review & Verify Deliverable ]                              [ Disburse Tranche Memo ] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Stage 3: PROCURE

## HERO SCREEN 3: Procurement Sanction Docket

When a pilot reaches `Completed` and is marked `Recommended for Procurement`, the officer generates the **Procurement Package**.

Because direct live API access to government e-Marketplace (GeM) is restricted, SAMARTH simulates the complete, compliance-ready GeM procurement docket.

### Sanction Docket Layout
The view is formatted as an official administrative sanction dossier:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ GOVERNMENT OF INDIA · DEPARTMENT OF MILITARY AFFAIRS                                   │
│ PILOT VALIDATION & SANCTION MEMORANDUM                                                 │
│ Sanction Order Ref: DMA/PROC/2026/0491                      Date: 28 October 2026     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. VENDOR IDENTIFICATION                                                               │
│    Vendor Name: AeroKisan Technologies Pvt Ltd                                         │
│    DPIIT Recognition: DIPP98234 [ VERIFIED ] · MSME Reg: UDYAM-KR-03-00941              │
│                                                                                        │
│ 2. PILOT PERFORMANCE SUMMARY                                                           │
│    Problem Reference: #PRB-2026-081                                                    │
│    Duration: 8 Weeks (Completed on schedule)                                           │
│    Milestones Achieved: 3 of 3 Verified                                                │
│    Final Performance Score: 94.2 / 100                                                 │
│                                                                                        │
│ 3. COMPLIANCE & EXEMPTIONS APPLIED                                                     │
│    [✓] GFR Rule 149 Exemption for Validated Innovation Pilot                           │
│    [✓] Prior Turnover & Prior Experience Exemption (DPIIT Circular 2016)               │
│    [✓] Independent Validator Sign-off Recorded                                         │
│                                                                                        │
│ 4. RECOMMENDED PROCUREMENT VALUE                                                       │
│    Total Sanction Amount: ₹42,50,000 (Unit Deployment × 10 systems)                     │
│                                                                                        │
│ [ Download Sanction Package (PDF) ]                 [ Push to GeM Simulation API ]     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Stage 4: SCALE

## HERO SCREEN 4: Proven Solutions & Scale Repository

The **Scale** stage allows other government departments to discover and replicate solutions that have already completed a successful pilot in another department, without starting from scratch.

### Scale Repository Grid
- Cards or rows displaying completed procurements.
- Each entry displays:
  - Solution Name & Startup
  - Originating Department (e.g. "Validated by Dept. of Agriculture")
  - Pilot Performance Score & Sanction Date
  - Field Report Summary
- Action: **"Request Inter-Department Replication"** button.

### Replication Request Modal
Clicking the action opens a structured modal:
- Target Department name & Nodal Officer contact
- Intended deployment site/quantity
- Generates a formal cross-department adoption request record saved in PostgreSQL.

---

# 28. COMPLIANCE ARTIFACTS & AUDIT STANDARDS

### 1. DPIIT Status Badges
Every startup profile and proposal card must display the verified DPIIT status:
- **Verified**: `--positive` text on `--positive-soft` container, with checkmark icon and mono number: `[✓ DPIIT: DIPP98234]`
- **Pending Verification**: `--warning` text on `--warning-soft`: `[⏱ DPIIT: Under Review]`
- **Unverified / General**: Muted mono text: `[ Non-DPIIT ]`

### 2. Audit Stamps
Every state transition (shortlisting, milestone approval, evaluator score, sanction generation) must display an immutable audit stamp:
```text
Logged by: Dr. A. Sharma (Director, DMA) · Timestamp: 2026-10-18 14:32 IST · Hash: 9f8a2b
```
Rendered in `IBM Plex Mono` (`--ink-muted`, `Micro 10px`).

---

# 29. COMPONENT SYSTEM ARCHITECTURE

Frontend files should be structured cleanly within `frontend/`:

```text
components/
├── ui/
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Dialog.tsx
│   ├── Popover.tsx
│   ├── Badge.tsx
│   └── Tabs.tsx
│
├── layout/
│   ├── AppShell.tsx
│   ├── Sidebar.tsx
│   ├── TopHeader.tsx
│   └── PageHeader.tsx
│
├── data/
│   ├── DataTable.tsx
│   ├── MetricCard.tsx
│   ├── StatusBadge.tsx
│   └── AuditStamp.tsx
│
├── feedback/
│   ├── LoadingSkeleton.tsx
│   ├── EmptyState.tsx
│   ├── ErrorBanner.tsx
│   └── Toast.tsx
│
└── domain/
    ├── StartupTagList.tsx           /* Editable AI extracted capability chips */
    ├── RankedSolutionCard.tsx       /* Hero card with match score & highlights */
    ├── SolutionInspectorDrawer.tsx  /* Side-by-side proposal inspection & rubric */
    ├── MilestoneStepper.tsx         /* Linear pilot lifecycle state banner */
    ├── MilestoneCard.tsx            /* Deliverable card with tranche & KPI */
    ├── EvaluatorRubricPanel.tsx     /* Scoring checklist */
    ├── SanctionDocketView.tsx       /* Official government sanction order */
    └── ReplicationModal.tsx         /* Cross-department scaling request */
```

---

# 30. AGENT OPERATING RULES

AI coding agents and developers working on the SAMARTH frontend must follow this sequence:

1. **Consult this document (`frontend/DESIGN.md`)** before writing or modifying any UI.
2. **Inspect existing CSS tokens** in `globals.css` / Tailwind configuration.
3. **Respect role boundaries**: Never mix Startup-specific actions into the Government Officer dashboard or vice-versa.
4. **Preserve the Civic Editorial aesthetic**: Warm parchment canvas, sovereign navy actions, warm ochre highlights, and clean typography.
5. **No AI Slop**: Never add decorative sparkles, purple glows, or bouncy animations.
6. **Ensure Auditability**: Display IDs, dates, and scores with `IBM Plex Mono`.
7. **Perform the Anti-Slop Review** before marking any frontend task complete.

---

# 31. ANTI-SLOP REVIEW CHECKLIST

Before submitting any frontend component or page, verify every item:

### A. Visual Identity
- [ ] Does the page use the warm canvas (`#F4F2EB`) and deep ink (`#161917`)?
- [ ] Is Sovereign Navy (`#1B365D`) the dominant primary action color?
- [ ] Are AI match scores and highlights using Warm Ochre (`#A25722`) without glowing borders?
- [ ] Are cards clean with 1px borders rather than heavy drop shadows?
- [ ] Are corner radii restrained (`6px` to `12px`)?

### B. Typography & Data
- [ ] Is `IBM Plex Sans` used for interface controls and tables?
- [ ] Is `Newsreader` used only for editorial titles and formal docket headers?
- [ ] Are Problem IDs, DPIIT numbers, and currency values formatted in `IBM Plex Mono`?
- [ ] Are currency values properly prefixed with `₹`?

### C. Domain & Flow
- [ ] Does the screen strictly reflect one of the four stages (`IDENTIFY`, `PILOT`, `PROCURE`, `SCALE`)?
- [ ] Are the two hero screens (Ranked Shortlist and Pilot Tracker) given the highest polish?
- [ ] Can an officer clearly understand *why* a proposal received its AI ranking?
- [ ] Are milestone state transitions strictly enforced without illegal jumps?
- [ ] Are loading, empty, and error states handled with concrete domain copy?

---

# DESIGN MANTRA

```text
Institutional trust before visual novelty.

Empirical evidence before AI magic.

Typography before decoration.

Auditability before convenience.

Hierarchy before density.

Restraint before spectacle.
```

**If an officer or startup founder cannot immediately understand their exact operational status within five seconds, the design is not finished.**