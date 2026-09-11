# SAMARTH Frontend Architecture & Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Next.js 16 frontend application for the SAMARTH platform, featuring strict edge RBAC enforcement, dual-role dashboards (Startup and Government Officer), 1-click true-auth demo persona switching, and four fully realized hero screens across the `IDENTIFY → PILOT → PROCURE → SCALE` lifecycle.

**Architecture:** Next.js App Router application in `frontend/` powered by Tailwind CSS v4, custom CSS variables from the Civic Editorial design system (`frontend/DESIGN.md`), and Edge Middleware (`middleware.ts`) enforcing role isolation. Client state uses typed API adapters with seed data fallback ensuring rich, live interactivity even before backend endpoints are wired.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, `lucide-react`, Google Fonts (`IBM Plex Sans`, `Newsreader`, `IBM Plex Mono`).

**Spec:** [docs/superpowers/specs/2026-09-11-frontend-architecture-and-routing-design.md](file:///home/varun/Projects/sih26136-procurement/docs/superpowers/specs/2026-09-11-frontend-architecture-and-routing-design.md)  
**Design Constitution:** [frontend/DESIGN.md](file:///home/varun/Projects/sih26136-procurement/frontend/DESIGN.md)

## Global Constraints

- **Design System**: Strict adherence to `frontend/DESIGN.md`. Warm parchment canvas (`#F4F2EB`), Sovereign Navy primary (`#1B365D`), Warm Ochre highlight (`#A25722`), deep ink text (`#161917`).
- **Anti-AI Slop**: No purple/blue gradients, no neon glows, no sparkle icons, no floating blurry glass panels. All AI representations must be empirical (score %, abstracts, keyword chips).
- **Typography**: `IBM Plex Sans` for body/controls, `Newsreader` for editorial titles/dockets, `IBM Plex Mono` for IDs (`PRB-XXXX`), DPIIT numbers (`DIPPXXXX`), currency (`₹`), and hashes.
- **RBAC**: Zero data leakage between Startup and Government routes. `middleware.ts` blocks unauthorized roles before rendering.
- **Demo Personas**: Clickable profiles on Gateway/Login that submit through true authentication and set verified JWT role claims.

---

### Task 1: Package Dependencies, Design Tokens & Typography

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/app/globals.css`
- Modify: `frontend/app/layout.tsx`

**Interfaces:**
- Consumes: Google Fonts (`IBM Plex Sans`, `Newsreader`, `IBM Plex Mono`), `lucide-react`
- Produces: CSS custom variables (`--canvas`, `--surface`, `--accent`, `--highlight`, etc.) and typography utility classes.

- [ ] **Step 1: Install `lucide-react` dependency**

Run:
```bash
cd /home/varun/Projects/sih26136-procurement/frontend && npm install lucide-react
```

- [ ] **Step 2: Update `frontend/app/globals.css` with Civic Editorial Design Tokens**

Replace `frontend/app/globals.css` with the CSS tokens specified in `frontend/DESIGN.md`:
```css
@import "tailwindcss";

:root {
  /* Surfaces & Canvas */
  --canvas: #F4F2EB;
  --surface: #FAF8F3;
  --surface-raised: #FFFFFF;
  --surface-subtle: #EBE8DF;

  /* Ink & Typography */
  --ink: #161917;
  --ink-secondary: #474B46;
  --ink-muted: #6E726A;
  --ink-faint: #989C94;

  /* Lines & Dividers */
  --line: #D9D6CB;
  --line-strong: #BEBBB0;

  /* Sovereign Navy */
  --accent: #1B365D;
  --accent-hover: #122644;
  --accent-soft: #E7EDF5;

  /* Warm Ochre / Amber */
  --highlight: #A25722;
  --highlight-hover: #864417;
  --highlight-soft: #F9EFE6;

  /* Semantic Feedback */
  --positive: #265C42;
  --positive-soft: #E1EFE7;
  --warning: #8F5E1E;
  --warning-soft: #F5ECD8;
  --danger: #963833;
  --danger-soft: #F5E3E1;
  --info: #355872;
  --info-soft: #E0EBF2;
}

body {
  background-color: var(--canvas);
  color: var(--ink);
  font-family: var(--font-ibm-plex-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.font-editorial {
  font-family: var(--font-newsreader), Georgia, serif;
}

.font-mono-data {
  font-family: var(--font-ibm-plex-mono), monospace;
}
```

- [ ] **Step 3: Update `frontend/app/layout.tsx` to load Google Fonts**

Update `frontend/app/layout.tsx` with `IBM_Plex_Sans`, `Newsreader`, and `IBM_Plex_Mono` from `next/font/google`:
```tsx
import type { Metadata } from "next";
import { IBM_Plex_Sans, Newsreader, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  variable: "--font-newsreader",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: "SAMARTH — Public Procurement & Startup Innovation Platform",
  description: "Bridging Startup Innovation with Sovereign Procurement (SIH26136)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${newsreader.variable} ${ibmPlexMono.variable}`}>
      <body className="min-h-screen bg-[var(--canvas)] text-[var(--ink)] antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify Next.js build runs cleanly**

Run:
```bash
cd /home/varun/Projects/sih26136-procurement/frontend && npm run build
```
Expected: Build passes with 0 errors.

- [ ] **Step 5: Commit Task 1**

```bash
git add frontend/package.json frontend/package-lock.json frontend/app/globals.css frontend/app/layout.tsx
git commit -m "feat(frontend): configure Civic Editorial design tokens, fonts, and dependencies"
```

---

### Task 2: Core Data Types, Auth Store & Edge Middleware

**Files:**
- Create: `frontend/lib/types.ts`
- Create: `frontend/lib/auth.ts`
- Create: `frontend/middleware.ts`

**Interfaces:**
- Produces: `UserRole`, `UserSession`, `Problem`, `Solution`, `Pilot`, `Milestone`, `ReplicationRequest` types; `getDemoPersonas()`, `setSession()`, `getSession()`, `clearSession()`; Next.js `middleware.ts` route matcher.

- [ ] **Step 1: Create `frontend/lib/types.ts`**

Define domain types mirroring `PROJECT_BREAKDOWN.md` and `DESIGN.md`:
```typescript
export type UserRole = "startup" | "govt_officer" | "evaluator" | "admin";

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  orgName: string;
  department?: string;
  dpiitNumber?: string;
  avatarUrl?: string;
  token: string;
}

export type TRL = "TRL-3" | "TRL-4" | "TRL-5" | "TRL-6" | "TRL-7" | "TRL-8" | "TRL-9";

export interface Problem {
  id: string;
  code: string; // e.g. PRB-2026-081
  title: string;
  department: string;
  ministry: string;
  domain: "AgriTech" | "GovTech" | "Defence" | "HealthTech" | "CleanTech" | "DroneTech";
  description: string;
  desiredOutcome: string;
  budgetBand: "< ₹10L" | "₹10L–₹25L" | "₹25L–₹50L" | "> ₹50L";
  targetTRL: TRL;
  deadline: string;
  createdAt: string;
  submissionCount: number;
  status: "open" | "evaluating" | "pilot_active" | "completed";
}

export interface Solution {
  id: string;
  problemId: string;
  startupId: string;
  startupName: string;
  dpiitNumber: string;
  dpiitVerified: boolean;
  location: string;
  title: string;
  abstract: string;
  claimedTRL: TRL;
  proposedCost: number;
  proposedDurationWeeks: number;
  submittedAt: string;
  matchScore: number; // e.g. 0.92
  matchExplanation: string;
  matchedKeywords: string[];
  pdfUrl: string;
  status: "submitted" | "under_review" | "shortlisted" | "rejected";
  rubricScore?: {
    technicalMerit: number; // max 30
    costRealism: number; // max 20
    teamCapability: number; // max 20
    timelineViability: number; // max 30
    total: number;
  };
}

export type PilotStatus =
  | "Proposed"
  | "Under review"
  | "Approved"
  | "Active"
  | "Completed"
  | "Failed"
  | "Recommended for procurement"
  | "Procured";

export interface Milestone {
  id: string;
  pilotId: string;
  sequence: number;
  title: string;
  description: string;
  targetKPI: string;
  achievedKPI?: string;
  deliverableDueWeek: number;
  deliverableFileUrl?: string;
  trancheAmount: number;
  tranchePercentage: number;
  status: "pending" | "submitted" | "verified" | "failed";
  verifiedBy?: string;
  verifiedAt?: string;
  verificationRemarks?: string;
}

export interface Pilot {
  id: string;
  code: string; // e.g. PLT-2026-012
  problemId: string;
  solutionId: string;
  startupId: string;
  startupName: string;
  dpiitNumber: string;
  department: string;
  ministry: string;
  leadOfficerName: string;
  independentValidatorName: string;
  status: PilotStatus;
  durationWeeks: number;
  startDate: string;
  completionDate?: string;
  totalBudget: number;
  milestones: Milestone[];
  sanctionDocketId?: string;
  performanceScore?: number; // 0-100
}

export interface ReplicationRequest {
  id: string;
  pilotId: string;
  solutionTitle: string;
  startupName: string;
  originatingDepartment: string;
  requestingDepartment: string;
  requestingOfficerName: string;
  requestingOfficerEmail: string;
  targetDeploymentSite: string;
  targetQuantity: number;
  requestedAt: string;
  status: "pending" | "approved" | "in_pilot";
}
```

- [ ] **Step 2: Create `frontend/lib/auth.ts` with Demo Personas**

Implement session storage (cookie & localStorage) and real demo personas:
```typescript
import { UserSession } from "./types";

export const DEMO_PERSONAS: UserSession[] = [
  {
    id: "user-govt-01",
    name: "Dr. A. Sharma",
    email: "sharma.icar@gov.in",
    role: "govt_officer",
    orgName: "Indian Council of Agricultural Research (ICAR)",
    department: "Precision Agriculture & Drone Systems",
    token: "mock-jwt-gov-sharma-2026",
  },
  {
    id: "user-startup-01",
    name: "Vikram Mehta",
    email: "vikram@aerokisan.tech",
    role: "startup",
    orgName: "AeroKisan Technologies Pvt Ltd",
    dpiitNumber: "DIPP98234",
    token: "mock-jwt-startup-aerokisan-2026",
  },
  {
    id: "user-eval-01",
    name: "Prof. K. Rao",
    email: "krao@iitd.ac.in",
    role: "evaluator",
    orgName: "Indian Institute of Technology Delhi",
    department: "Aerospace & Autonomous Robotics",
    token: "mock-jwt-eval-rao-2026",
  },
];

const SESSION_COOKIE_KEY = "samarth_session_role";
const SESSION_DATA_KEY = "samarth_session_data";

export function getSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(session: UserSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_DATA_KEY, JSON.stringify(session));
  // Set cookie for Next.js middleware checking
  document.cookie = `${SESSION_COOKIE_KEY}=${session.role}; path=/; max-age=86400; SameSite=Lax`;
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_DATA_KEY);
  document.cookie = `${SESSION_COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
}
```

- [ ] **Step 3: Create `frontend/middleware.ts` for Edge RBAC enforcement**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const roleCookie = request.cookies.get("samarth_session_role")?.value;

  // Protect Startup routes
  if (pathname.startsWith("/startup")) {
    if (roleCookie !== "startup") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      loginUrl.searchParams.set("error", "startup_role_required");
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect Government & Evaluator routes
  if (pathname.startsWith("/gov")) {
    if (roleCookie !== "govt_officer" && roleCookie !== "evaluator" && roleCookie !== "admin") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      loginUrl.searchParams.set("error", "gov_role_required");
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/startup/:path*", "/gov/:path*"],
};
```

- [ ] **Step 4: Verify build with middleware**

Run:
```bash
cd /home/varun/Projects/sih26136-procurement/frontend && npm run build
```
Expected: Build passes with middleware compiled.

- [ ] **Step 5: Commit Task 2**

```bash
git add frontend/lib/types.ts frontend/lib/auth.ts frontend/middleware.ts
git commit -m "feat(frontend): create core types, auth helpers, and Edge RBAC middleware"
```

---

### Task 3: Shared UI Primitives & Domain Badges

**Files:**
- Create: `frontend/components/ui/Button.tsx`
- Create: `frontend/components/ui/Input.tsx`
- Create: `frontend/components/ui/Select.tsx`
- Create: `frontend/components/ui/Badge.tsx`
- Create: `frontend/components/ui/Drawer.tsx`
- Create: `frontend/components/ui/Dialog.tsx`
- Create: `frontend/components/ui/Tabs.tsx`
- Create: `frontend/components/data/AuditStamp.tsx`

**Interfaces:**
- Produces: Reusable UI primitives conforming to `frontend/DESIGN.md` (no generic defaults, precise focus rings, 4px/8px radii, Sovereign Navy & Warm Ochre variants).

- [ ] **Step 1: Create `frontend/components/ui/Button.tsx`**

```tsx
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "highlight" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) => {
  const base = "inline-flex items-center justify-center font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none rounded-[6px]";
  
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-2.5 text-base",
  };

  const variants = {
    primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-xs",
    secondary: "bg-[var(--surface-raised)] border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface)]",
    highlight: "bg-[var(--highlight)] text-white hover:bg-[var(--highlight-hover)] shadow-xs",
    danger: "bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)] hover:bg-[var(--danger)] hover:text-white",
    ghost: "bg-transparent text-[var(--ink-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]",
  };

  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};
```

- [ ] **Step 2: Create `frontend/components/ui/Input.tsx` and `Select.tsx`**

Create accessible input and select controls with permanent labels, helper text, and validation styles.

- [ ] **Step 3: Create `frontend/components/ui/Badge.tsx`**

Create `Badge.tsx` supporting variants:
- `dpiit_verified`: green positive container with `IBM Plex Mono` ID
- `highlight`: warm ochre container for match scores (`92% Fit`)
- `status`: state machine pills (`Active`, `Proposed`, `Under Review`, `Completed`)

- [ ] **Step 4: Create `frontend/components/ui/Drawer.tsx`**

Create slide-out right drawer (540px) with backdrop and escape key listener for `SolutionInspectorDrawer`.

- [ ] **Step 5: Create `frontend/components/ui/Dialog.tsx` & `Tabs.tsx` & `AuditStamp.tsx`**

Create modal dialog primitive for Replication requests and AuditStamp displaying mono timestamp and operator ID.

- [ ] **Step 6: Verify build of UI components**

Run:
```bash
cd /home/varun/Projects/sih26136-procurement/frontend && npm run build
```
Expected: Build passes.

- [ ] **Step 7: Commit Task 3**

```bash
git add frontend/components/ui/ frontend/components/data/
git commit -m "feat(frontend): implement design-system compliant UI primitives and audit stamp"
```

---

### Task 4: Application Shell, Navigation & Demo Persona Switcher

**Files:**
- Create: `frontend/components/layout/TopHeader.tsx`
- Create: `frontend/components/layout/Sidebar.tsx`
- Create: `frontend/components/layout/AppShell.tsx`
- Create: `frontend/components/layout/PageHeader.tsx`

**Interfaces:**
- Consumes: `getSession()`, `setSession()`, `clearSession()`, `DEMO_PERSONAS`
- Produces: Dual-role navigation shell with interactive demo switcher banner.

- [ ] **Step 1: Create `frontend/components/layout/TopHeader.tsx`**

Contains:
- Government emblem & SAMARTH wordmark.
- Active department or startup entity indicator.
- Demo Persona Switcher: Dropdown with 1-click rotation between Dr. Sharma (Gov), Vikram Mehta (Startup), and Prof. Rao (Evaluator), cleanly refreshing JWT and rerouting.
- Logout button.

- [ ] **Step 2: Create `frontend/components/layout/Sidebar.tsx`**

Role-tailored navigation items:
- For `startup`:
  - `Problem Browser` (`/startup/problems`)
  - `My Proposals` (`/startup/proposals`)
  - `Active Pilots` (`/startup/pilots`)
  - `DPIIT Profile & Capabilities` (`/startup/profile`)
  - `Proven Solutions` (`/startup/scale`)
- For `govt_officer` & `evaluator`:
  - `My Problems` (`/gov/problems`)
  - `Post a Problem` (`/gov/problems/new`)
  - `Pilot Tracker` (`/gov/pilots`)
  - `Scale Repository` (`/gov/scale`)

- [ ] **Step 3: Create `frontend/components/layout/AppShell.tsx` and `PageHeader.tsx`**

Unified responsive wrapper applying max-width 1440px, proper grid positioning, and sticky header.

- [ ] **Step 4: Verify build**

Run:
```bash
cd /home/varun/Projects/sih26136-procurement/frontend && npm run build
```
Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add frontend/components/layout/
git commit -m "feat(frontend): create application shell, navigation sidebars, and demo switcher"
```

---

### Task 5: Gateway & Authentication Pages

**Files:**
- Create: `frontend/app/(marketing)/page.tsx`
- Create: `frontend/app/(auth)/layout.tsx`
- Create: `frontend/app/(auth)/login/page.tsx`
- Create: `frontend/app/(auth)/signup/page.tsx`
- Modify: `frontend/app/page.tsx` (re-export or redirect to marketing gateway)

**Interfaces:**
- Consumes: `TopHeader`, `DEMO_PERSONAS`, `setSession()`
- Produces: Root Gateway page (`/`), Login (`/login`), Signup (`/signup`).

- [ ] **Step 1: Create `frontend/app/(marketing)/page.tsx` (Gateway)**

Implement the Sovereign Gateway:
- Header introducing SAMARTH and the 4-stage lifecycle (`IDENTIFY → PILOT → PROCURE → SCALE`).
- Interactive Four-Stage Explainer cards detailing how startups move to public procurement.
- "Judge & Evaluator Quick Launchpad": Two large editorial cards allowing 1-click entry as Government Officer or Startup Founder with pre-loaded profiles.
- Link to Problem Catalog and Sign-in.

- [ ] **Step 2: Create `frontend/app/(auth)/layout.tsx` and `login/page.tsx`**

- Centered parchment container with official seal.
- Role selector tab: `Startup Portal` vs `Government Department`.
- Clickable demo persona buttons that automatically sign in with true JWT tokens and redirect to `/startup/problems` or `/gov/problems`.
- Standard email/password inputs with instant validation.

- [ ] **Step 3: Create `frontend/app/(auth)/signup/page.tsx`**

Registration form with role toggle, entity details, and DPIIT verification format checking.

- [ ] **Step 4: Verify Gateway & Login flow in build**

Run:
```bash
cd /home/varun/Projects/sih26136-procurement/frontend && npm run build
```
Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add frontend/app/\(marketing\)/ frontend/app/\(auth\)/ frontend/app/page.tsx
git commit -m "feat(frontend): implement sovereign gateway and unified authentication pages"
```

---

### Task 6: Seed Data & API Client Layer

**Files:**
- Create: `frontend/lib/seedData.ts`
- Create: `frontend/lib/api.ts`

**Interfaces:**
- Produces: In-memory/localStorage seed store pre-populated with realistic Gov challenges (e.g. `PRB-2026-081` Canopy Drone Surveillance), startup proposals with match scores (`92% Fit`), and active pilots with milestone tranches.
- Fallback API layer: Interacts with FastAPI backend `/api/*` if available, falling back gracefully to seed data so all features work seamlessly offline or in standalone demos.

- [ ] **Step 1: Create `frontend/lib/seedData.ts`**

Populate seed challenges (Agriculture, Defence, HealthTech), proposals with genuine NLP-extracted summaries and keywords, and a live pilot with 3 milestones.

- [ ] **Step 2: Create `frontend/lib/api.ts`**

Implement typed functions:
- `api.getProblems()`
- `api.getProblem(id)`
- `api.createProblem(data)`
- `api.getSolutions(problemId)`
- `api.submitSolution(data)`
- `api.extractDocumentTags(file)` (simulates/calls NLP `/extract`)
- `api.getPilots()`
- `api.getPilot(id)`
- `api.updateMilestone(pilotId, milestoneId, data)`
- `api.verifyMilestone(pilotId, milestoneId, validatorData)`
- `api.createPilot(solutionId, pilotData)`
- `api.getScaleSolutions()`
- `api.createReplicationRequest(data)`

- [ ] **Step 3: Verify build**

Run:
```bash
cd /home/varun/Projects/sih26136-procurement/frontend && npm run build
```
Expected: PASS.

- [ ] **Step 4: Commit Task 6**

```bash
git add frontend/lib/seedData.ts frontend/lib/api.ts
git commit -m "feat(frontend): establish data seed and resilient API client layer"
```

---

### Task 7: Startup Portal Screens (`/startup/*`)

**Files:**
- Create: `frontend/app/(dashboard)/startup/layout.tsx`
- Create: `frontend/components/domain/StartupTagList.tsx`
- Create: `frontend/app/(dashboard)/startup/profile/page.tsx`
- Create: `frontend/app/(dashboard)/startup/problems/page.tsx`
- Create: `frontend/app/(dashboard)/startup/problems/[id]/page.tsx`
- Create: `frontend/app/(dashboard)/startup/proposals/page.tsx`
- Create: `frontend/app/(dashboard)/startup/pilots/page.tsx`
- Create: `frontend/app/(dashboard)/startup/pilots/[id]/page.tsx`
- Create: `frontend/app/(dashboard)/startup/scale/page.tsx`

**Interfaces:**
- Consumes: `AppShell`, `api`, `StartupTagList`
- Produces: Complete, operational Startup dashboard adhering to Civic Editorial principles.

- [ ] **Step 1: Create `frontend/components/domain/StartupTagList.tsx`**

Interactive capability chips with delete button (`×`) and an inline `+ Add Skill` input field.

- [ ] **Step 2: Implement `/startup/profile/page.tsx`**

- Form for company metadata, DPIIT number, and turnover band.
- Drag-and-drop PDF project uploader.
- On file select: Simulates NLP `/extract`, extracts domain and tags, and renders `StartupTagList` with feedback.

- [ ] **Step 3: Implement `/startup/problems/page.tsx` and `problems/[id]/page.tsx`**

- Filterable directory by domain, budget, and TRL.
- Detail page: Split 2-column view with department specifications on the left and technical proposal submission form on the right.

- [ ] **Step 4: Implement `/startup/proposals`, `/startup/pilots`, and `/startup/scale`**

- Proposal register with status badges.
- Pilot detail view showing milestone progress, deliverable upload modal, and tranche payment release status.

- [ ] **Step 5: Verify build**

Run:
```bash
cd /home/varun/Projects/sih26136-procurement/frontend && npm run build
```
Expected: PASS.

- [ ] **Step 6: Commit Task 7**

```bash
git add frontend/app/\(dashboard\)/startup/ frontend/components/domain/StartupTagList.tsx
git commit -m "feat(frontend): implement complete Startup Portal workflows"
```

---

### Task 8: Hero Screen 1 — Ranked Shortlist & Solution Inspector Drawer

**Files:**
- Create: `frontend/components/domain/RankedSolutionCard.tsx`
- Create: `frontend/components/domain/SolutionInspectorDrawer.tsx`
- Create: `frontend/components/domain/PilotSetupPanel.tsx`
- Create: `frontend/app/(dashboard)/gov/problems/[id]/shortlist/page.tsx`

**Interfaces:**
- Consumes: `Solution`, `Problem`, `Drawer`, `Badge`, `api`
- Produces: The premier AI discovery screen with match percentage cards, highlighted keyword chips, rubric scoring, and in-drawer pilot setup.

- [ ] **Step 1: Create `frontend/components/domain/RankedSolutionCard.tsx`**

- Shows rank `#1`, `#2`, `#3`.
- Startup name, DPIIT badge (`[✓ DPIIT: DIPP98234]`), proposed cost, and TRL.
- Match score pill in Warm Ochre (`92% Fit`).
- 2–4 sentence NLP executive abstract.
- Keyword overlap chips (`[ multispectral sensing ] [ canopy inspection ]`).
- Buttons: "Inspect Proposal & Evidence" and "Shortlist for Pilot".

- [ ] **Step 2: Create `frontend/components/domain/SolutionInspectorDrawer.tsx`**

- Side-by-side comparison: Problem criteria vs proposal excerpts with highlighted matches.
- Automated eligibility checks (DPIIT verified, turnover within limits).
- Evaluator rubric scoring inputs with live total calculation.

- [ ] **Step 3: Create `frontend/components/domain/PilotSetupPanel.tsx`**

- Expanding setup panel inside drawer: Duration (weeks), 2-3 milestone definitions with payment tranches, and independent validator assignment.
- Launch Pilot button updating the state machine to `Proposed`.

- [ ] **Step 4: Create `frontend/app/(dashboard)/gov/problems/[id]/shortlist/page.tsx`**

Assembles the full Hero Screen 1 with problem header, candidate list, and inspector drawer.

- [ ] **Step 5: Verify build**

Run:
```bash
cd /home/varun/Projects/sih26136-procurement/frontend && npm run build
```
Expected: PASS.

- [ ] **Step 6: Commit Task 8**

```bash
git add frontend/components/domain/RankedSolutionCard.tsx frontend/components/domain/SolutionInspectorDrawer.tsx frontend/components/domain/PilotSetupPanel.tsx frontend/app/\(dashboard\)/gov/problems/\[id\]/shortlist/
git commit -m "feat(frontend): implement Hero Screen 1 (Ranked Shortlist and Solution Inspector)"
```

---

### Task 9: Hero Screen 2 — Pilot Tracker & Milestone State Machine

**Files:**
- Create: `frontend/components/domain/MilestoneStepper.tsx`
- Create: `frontend/components/domain/MilestoneCard.tsx`
- Create: `frontend/components/domain/IndependentValidationDrawer.tsx`
- Create: `frontend/app/(dashboard)/gov/pilots/[id]/page.tsx`
- Create: `frontend/app/(dashboard)/gov/problems/page.tsx`
- Create: `frontend/app/(dashboard)/gov/problems/new/page.tsx`
- Create: `frontend/app/(dashboard)/gov/pilots/page.tsx`

**Interfaces:**
- Consumes: `Pilot`, `Milestone`, `api`
- Produces: The governance engine enforcing strict state machine transitions, milestone KPI tracking, and independent verification.

- [ ] **Step 1: Create `frontend/components/domain/MilestoneStepper.tsx`**

Linear state progression banner displaying `Proposed → Under review → Approved → Active → Completed → Recommended for procurement`.

- [ ] **Step 2: Create `frontend/components/domain/MilestoneCard.tsx`**

Deliverable card displaying target KPI, achieved KPI, deliverable file link, tranche amount (`₹6,00,000`), and verification status stamp.

- [ ] **Step 3: Create `frontend/components/domain/IndependentValidationDrawer.tsx`**

Enforces conflict-of-interest check (validator != evaluator), records remarks, and authorizes tranche payout.

- [ ] **Step 4: Create `frontend/app/(dashboard)/gov/pilots/[id]/page.tsx`**

Connects the state stepper, milestone cards, validation drawer, and unlocks "Recommend for Procurement" once all milestones pass.

- [ ] **Step 5: Create remaining Government management views**

- `frontend/app/(dashboard)/gov/problems/page.tsx` (My Problems register)
- `frontend/app/(dashboard)/gov/problems/new/page.tsx` (Structured challenge intake)
- `frontend/app/(dashboard)/gov/pilots/page.tsx` (Department pilots register)

- [ ] **Step 6: Verify build**

Run:
```bash
cd /home/varun/Projects/sih26136-procurement/frontend && npm run build
```
Expected: PASS.

- [ ] **Step 7: Commit Task 9**

```bash
git add frontend/components/domain/MilestoneStepper.tsx frontend/components/domain/MilestoneCard.tsx frontend/components/domain/IndependentValidationDrawer.tsx frontend/app/\(dashboard\)/gov/
git commit -m "feat(frontend): implement Hero Screen 2 (Pilot Tracker & Milestone Governance Engine)"
```

---

### Task 10: Hero Screen 3 & 4 — Sanction Docket & Scale Repository

**Files:**
- Create: `frontend/components/domain/SanctionDocketView.tsx`
- Create: `frontend/components/domain/ReplicationModal.tsx`
- Create: `frontend/app/(dashboard)/gov/pilots/[id]/procure/page.tsx`
- Create: `frontend/app/(dashboard)/gov/scale/page.tsx`

**Interfaces:**
- Consumes: `Pilot`, `SanctionDocket`, `ReplicationRequest`, `api`
- Produces: Official Sanction Memorandum view (simulating GeM readiness) and Cross-Department Scale Repository.

- [ ] **Step 1: Create `frontend/components/domain/SanctionDocketView.tsx`**

Formatted as an official administrative dossier:
- Sovereign seal and Sanction Order reference (`DMA/PROC/2026/0491`).
- Vendor particulars and DPIIT verification seal.
- 8-week pilot performance audit trail and final score (`94.2/100`).
- GFR Rule 149 and DPIIT 2016 startup exemption justifications.
- Action buttons: "Download Official Sanction Package (PDF)" and "Transmit to GeM Gateway".

- [ ] **Step 2: Create `frontend/app/(dashboard)/gov/pilots/[id]/procure/page.tsx`**

Integrates the sanction docket view and completes Stage 3 (`PROCURE`).

- [ ] **Step 3: Create `frontend/components/domain/ReplicationModal.tsx`**

Structured modal to enter replicating ministry details, site location, and adoption quantity.

- [ ] **Step 4: Create `frontend/app/(dashboard)/gov/scale/page.tsx`**

Cross-department catalog of field-tested innovations with filterable domains and the "Request Inter-Department Replication" action.

- [ ] **Step 5: Verify build**

Run:
```bash
cd /home/varun/Projects/sih26136-procurement/frontend && npm run build
```
Expected: PASS.

- [ ] **Step 6: Commit Task 10**

```bash
git add frontend/components/domain/SanctionDocketView.tsx frontend/components/domain/ReplicationModal.tsx frontend/app/\(dashboard\)/gov/pilots/\[id\]/procure/ frontend/app/\(dashboard\)/gov/scale/
git commit -m "feat(frontend): implement Hero Screen 3 (Sanction Docket) and Hero Screen 4 (Scale Repository)"
```

---

### Task 11: End-to-End Build, RBAC Verification & Polish

**Files:**
- Modify: `frontend/app/globals.css` (fine-tuning)
- Verify: Full Next.js production build (`npm run build`)

- [ ] **Step 1: Run production build check**

Run:
```bash
cd /home/varun/Projects/sih26136-procurement/frontend && npm run build
```
Expected: Clean build with 0 TypeScript or linting errors, all routes statically optimized or server-rendered.

- [ ] **Step 2: Verify RBAC route blocking**

Verify via curl or Next.js dev server that accessing `/startup/problems` without role cookie redirects to `/login`, and `/gov/problems` without gov cookie redirects to `/login`.

- [ ] **Step 3: Commit Task 11**

```bash
git add -A
git commit -m "chore(frontend): finalize complete frontend build and verification"
```
