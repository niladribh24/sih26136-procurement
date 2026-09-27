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
  trancheDisbursed?: boolean;
  disbursedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationRemarks?: string;
  verificationReportUrl?: string;
}

export interface Pilot {
  id: string;
  code: string; // e.g. PLT-2026-012
  problemId: string;
  solutionId: string;
  startupId: string;
  startupName: string;
  dpiitNumber: string;
  dpiitVerified?: boolean;
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
  sanctionOrderRef?: string;
  performanceScore?: number; // 0-100
}

export interface ScaleSolution {
  id: string;
  pilotCode: string;
  title: string;
  domain: string;
  startupName: string;
  dpiitNumber: string;
  originatingDepartment: string;
  validationDate: string;
  performanceScore: number;
  deployedUnits: number;
  budgetPerUnit: string;
  totalBudget?: number;
  summary: string;
  gfrExemptionClause: string;
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
  targetBudget?: number;
  deploymentTimelineWeeks?: number;
  requestedAt: string;
  status: "pending" | "approved" | "in_pilot";
}


// ---- Backend-only shapes (defined in backend/docs/api_contract.md; no mock equivalent originally) ----

export type TurnoverBand = "< ₹1Cr" | "₹1Cr–₹5Cr" | "₹5Cr–₹25Cr" | "> ₹25Cr";

export interface StartupDocument {
  id: string;
  fileName: string;
  uploadedAt: string;
  extractionStatus: "done" | "pending"; // "pending" = ML service was offline; backend retries later
}

/** POST /api/startups/me/documents. ML fields are "" / [] while extractionStatus is "pending". */
export interface DocumentUploadResult extends StartupDocument {
  domain: string;
  tags: string[];
  skills: string[];
  summary: string;
}

export interface StartupProfile {
  userId: string;
  startupName: string;
  dpiitNumber: string;
  dpiitVerified: boolean;
  domain?: string;
  turnoverBand?: TurnoverBand;
  location?: string;
  incorporationYear?: number;
  description?: string;
  tags: string[];
  skills: string[];
  documents: StartupDocument[];
}

/** PATCH /api/startups/me — omitted = unchanged, null clears an optional field. */
export interface StartupProfileUpdate {
  startupName?: string;
  dpiitNumber?: string;
  turnoverBand?: TurnoverBand | null;
  location?: string | null;
  incorporationYear?: number | null;
  description?: string | null;
}

export type EligibilityRuleStatus = "pass" | "fail" | "pending";

export interface Eligibility {
  solutionId: string;
  status: "eligible" | "ineligible" | "pending";
  overallEligible: boolean | null;
  checkedAt: string; // ISO 8601
  rules: {
    rule: "dpiit" | "turnover" | "domain" | "trl";
    label: string;
    status: EligibilityRuleStatus;
    reason: string;
  }[];
}

/** The backend's matchExplanation for a solution ML /rank hasn't scored yet (matchScore is 0 then). */
export const MATCH_PENDING_EXPLANATION = "AI match analysis pending.";

export function isMatchPending(sol: Pick<Solution, "matchExplanation">): boolean {
  return sol.matchExplanation === MATCH_PENDING_EXPLANATION;
}
