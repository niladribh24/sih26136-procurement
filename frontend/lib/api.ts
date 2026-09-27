"use client";

import {
  Problem,
  Solution,
  Pilot,
  Milestone,
  ReplicationRequest,
  ScaleSolution,
  UserRole,
  UserSession,
  TRL,
  StartupProfile,
  StartupProfileUpdate,
  StartupDocument,
  DocumentUploadResult,
  Eligibility,
} from "./types";
import { USE_MOCK_API } from "./config";
import { canTransition } from "./pilotStateMachine";
import { ApiError, apiFetch, apiFetchOrNull } from "./http";
import { DEMO_PASSWORD, DEMO_PERSONAS, getSession, setSession } from "./auth";
import {
  SEED_PROBLEMS,
  SEED_SOLUTIONS,
  SEED_PILOTS,
  SEED_SCALE_SOLUTIONS,
  SEED_REPLICATION_REQUESTS,
} from "./seedData";

// Local storage keys for client persistence during demo
const STORAGE_KEYS = {
  PROBLEMS: "samarth_store_problems",
  SOLUTIONS: "samarth_store_solutions",
  PILOTS: "samarth_store_pilots",
  REPLICATIONS: "samarth_store_replications",
  PROFILE: "samarth_startup_profile",
  DOCUMENTS: "samarth_store_documents",
};

function getStored<T>(key: string, seed: T): T {
  if (typeof window === "undefined") return seed;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : seed;
  } catch {
    return seed;
  }
}

function setStored<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`[SAMARTH] Storage quota exceeded or error on key: ${key}`, err);
  }
}

export type NewSolution = Omit<
  Solution,
  "id" | "submittedAt" | "matchScore" | "matchExplanation" | "matchedKeywords" | "status"
>;

export interface ApiService {
  getProblems: () => Promise<Problem[]>;
  getProblem: (id: string) => Promise<Problem | null>;
  createProblem: (newProblem: Omit<Problem, "id" | "code" | "createdAt" | "submissionCount" | "status">) => Promise<Problem>;
  getSolutions: (problemId?: string) => Promise<Solution[]>;
  getSolution: (id: string) => Promise<Solution | null>;
  getProposalsByStartup: (startupId: string) => Promise<Solution[]>;
  /** `file` is the proposal PDF: required by the real backend, ignored by the mock. */
  submitSolution: (newSolution: NewSolution, file?: File) => Promise<Solution>;
  updateSolutionStatus: (solutionId: string, status: Solution["status"]) => Promise<Solution | null>;
  updateSolutionRubric: (
    solutionId: string,
    rubric: {
      technicalMerit: number;
      costRealism: number;
      teamCapability: number;
      timelineViability: number;
    }
  ) => Promise<Solution | null>;
  getPilots: () => Promise<Pilot[]>;
  getPilot: (id: string) => Promise<Pilot | null>;
  createPilot: (pilotData: Omit<Pilot, "id" | "code" | "startDate" | "status">) => Promise<Pilot>;
  updatePilotStatus: (pilotId: string, status: Pilot["status"]) => Promise<Pilot | null>;
  verifyMilestone: (
    pilotId: string,
    milestoneId: string,
    verifiedBy: string,
    remarks: string,
    status?: "verified" | "failed",
    verificationReportUrl?: string
  ) => Promise<Pilot | null>;
  disburseTranche: (pilotId: string, milestoneId: string) => Promise<Pilot | null>;
  submitMilestoneDeliverable: (
    pilotId: string,
    milestoneId: string,
    achievedKPI: string,
    fileUrl: string
  ) => Promise<Pilot | null>;
  /** Uploads a startup document; the backend runs ML /extract on it. */
  extractDocumentTags: (file: File) => Promise<DocumentUploadResult>;
  getMyProfile: () => Promise<StartupProfile>;
  updateMyProfile: (changes: StartupProfileUpdate) => Promise<StartupProfile>;
  getMyDocuments: () => Promise<StartupDocument[]>;
  /** Forces a fresh ML /rank of every solution to the problem (owning officer or evaluator). */
  rankSolutions: (problemId: string) => Promise<Solution[]>;
  getEligibility: (solutionId: string) => Promise<Eligibility>;
  rerunEligibility: (solutionId: string) => Promise<Eligibility>;
  getScaleSolutions: () => Promise<ScaleSolution[]>;
  getReplications: () => Promise<ReplicationRequest[]>;
  createReplicationRequest: (req: Omit<ReplicationRequest, "id" | "requestedAt" | "status">) => Promise<ReplicationRequest>;
  logAuditEntry: (entry: {
    pilotId: string;
    action: string;
    actorName: string;
    actorRole: string;
    hash?: string;
  }) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Mock implementation (localStorage). Selected with NEXT_PUBLIC_USE_MOCK_API=true.
// In backend mode it still serves the scale/replication/audit methods (see realApi below).
// ---------------------------------------------------------------------------
const mockApi: ApiService = {
  // Problems
  getProblems: async (): Promise<Problem[]> => {
    return getStored<Problem[]>(STORAGE_KEYS.PROBLEMS, SEED_PROBLEMS);
  },

  getProblem: async (id: string): Promise<Problem | null> => {
    const problems = await mockApi.getProblems();
    return problems.find((p) => p.id === id || p.code === id) || null;
  },

  createProblem: async (newProblem: Omit<Problem, "id" | "code" | "createdAt" | "submissionCount" | "status">): Promise<Problem> => {
    const problems = await mockApi.getProblems();
    const created: Problem = {
      ...newProblem,
      id: `prob-${Date.now()}`,
      code: `PRB-2026-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString().split("T")[0],
      submissionCount: 0,
      status: "open",
    };
    const updated = [created, ...problems];
    setStored(STORAGE_KEYS.PROBLEMS, updated);
    return created;
  },

  // Solutions
  getSolutions: async (problemId?: string): Promise<Solution[]> => {
    const solutions = getStored<Solution[]>(STORAGE_KEYS.SOLUTIONS, SEED_SOLUTIONS);
    if (problemId) {
      return solutions.filter((s) => s.problemId === problemId);
    }
    return solutions;
  },

  getSolution: async (id: string): Promise<Solution | null> => {
    const solutions = await mockApi.getSolutions();
    return solutions.find((s: Solution) => s.id === id) || null;
  },

  getProposalsByStartup: async (startupId: string): Promise<Solution[]> => {
    const solutions = await mockApi.getSolutions();
    return solutions.filter((s: Solution) => s.startupId === startupId);
  },

  submitSolution: async (newSolution: NewSolution): Promise<Solution> => {
    const solutions = await mockApi.getSolutions();

    // Simulated NLP summarization & cosine similarity score
    const simulatedScore = 0.88;
    const created: Solution = {
      ...newSolution,
      id: `sol-${Date.now()}`,
      submittedAt: new Date().toISOString().split("T")[0],
      matchScore: simulatedScore,
      matchExplanation:
        "High semantic similarity to required technical parameters. Identified key capability match on edge compute, low latency, and ruggedized housing.",
      matchedKeywords: [
        "autonomous control",
        "real-time edge inference",
        "encrypted telemetry",
        "TRL compliance",
      ],
      status: "submitted",
    };

    const updated = [created, ...solutions];
    setStored(STORAGE_KEYS.SOLUTIONS, updated);

    // Increment problem submission count
    const problems = await mockApi.getProblems();
    const targetProblem = problems.find((p: Problem) => p.id === newSolution.problemId);
    if (targetProblem) {
      targetProblem.submissionCount += 1;
      setStored(STORAGE_KEYS.PROBLEMS, problems);
    }

    return created;
  },

  updateSolutionStatus: async (solutionId: string, status: Solution["status"]): Promise<Solution | null> => {
    const solutions = await mockApi.getSolutions();
    const sol = solutions.find((s: Solution) => s.id === solutionId);
    if (!sol) return null;
    sol.status = status;
    setStored(STORAGE_KEYS.SOLUTIONS, solutions);
    return sol;
  },

  updateSolutionRubric: async (
    solutionId: string,
    rubric: {
      technicalMerit: number;
      costRealism: number;
      teamCapability: number;
      timelineViability: number;
    }
  ): Promise<Solution | null> => {
    const solutions = await mockApi.getSolutions();
    const sol = solutions.find((s: Solution) => s.id === solutionId);
    if (!sol) return null;

    const total =
      rubric.technicalMerit +
      rubric.costRealism +
      rubric.teamCapability +
      rubric.timelineViability;

    sol.rubricScore = { ...rubric, total };
    setStored(STORAGE_KEYS.SOLUTIONS, solutions);
    return sol;
  },

  // Pilots
  getPilots: async (): Promise<Pilot[]> => {
    return getStored<Pilot[]>(STORAGE_KEYS.PILOTS, SEED_PILOTS);
  },

  getPilot: async (id: string): Promise<Pilot | null> => {
    const pilots = await mockApi.getPilots();
    return pilots.find((p: Pilot) => p.id === id || p.code === id) || null;
  },

  createPilot: async (pilotData: Omit<Pilot, "id" | "code" | "startDate" | "status">): Promise<Pilot> => {
    const pilots = await mockApi.getPilots();
    const pilotId = `plt-${Date.now()}`;
    const created: Pilot = {
      ...pilotData,
      id: pilotId,
      code: `PLT-2026-${Math.floor(10 + Math.random() * 90)}`,
      startDate: new Date().toISOString().split("T")[0],
      status: "Approved", // like the backend: the officer starts it from the pilot page
      milestones: (pilotData.milestones || []).map((m: any) => ({
        ...m,
        pilotId,
      })),
    };

    const updated = [created, ...pilots];
    setStored(STORAGE_KEYS.PILOTS, updated);

    // Update parent problem status to "pilot_active"
    if (pilotData.problemId) {
      const problems = await mockApi.getProblems();
      const problem = problems.find((p: Problem) => p.id === pilotData.problemId);
      if (problem) {
        problem.status = "pilot_active";
        setStored(STORAGE_KEYS.PROBLEMS, problems);
      }
    }

    return created;
  },

  updatePilotStatus: async (pilotId: string, status: Pilot["status"]): Promise<Pilot | null> => {
    const pilots = await mockApi.getPilots();
    const pilot = pilots.find((p: Pilot) => p.id === pilotId);
    if (!pilot) return null;
    if (!canTransition(pilot.status, status)) {
      throw new ApiError(400, `Cannot move pilot from "${pilot.status}" to "${status}".`);
    }
    pilot.status = status;
    setStored(STORAGE_KEYS.PILOTS, pilots);
    return pilot;
  },

  verifyMilestone: async (
    pilotId: string,
    milestoneId: string,
    verifiedBy: string,
    remarks: string,
    status: "verified" | "failed" = "verified",
    verificationReportUrl?: string
  ): Promise<Pilot | null> => {
    const pilots = await mockApi.getPilots();
    const pilot = pilots.find((p: Pilot) => p.id === pilotId);
    if (!pilot) return null;

    const milestone = pilot.milestones.find((m: Milestone) => m.id === milestoneId);
    if (!milestone) return null;

    milestone.status = status;
    milestone.verifiedBy = verifiedBy;
    milestone.verifiedAt = new Date().toISOString().replace("T", " ").substring(0, 19) + " IST";
    milestone.verificationRemarks = remarks;
    if (verificationReportUrl) {
      milestone.verificationReportUrl = verificationReportUrl;
    }

    // Check if all milestones are verified
    if (status === "verified") {
      const allVerified = pilot.milestones.every((m: Milestone) => m.status === "verified");
      if (allVerified) {
        pilot.status = "Completed";
      }
    } else if (status === "failed") {
      // If a milestone fails, do not auto-complete
      if (pilot.status === "Completed") {
        pilot.status = "Active";
      }
    }

    setStored(STORAGE_KEYS.PILOTS, pilots);
    return pilot;
  },

  disburseTranche: async (pilotId: string, milestoneId: string): Promise<Pilot | null> => {
    const pilots = await mockApi.getPilots();
    const pilot = pilots.find((p: Pilot) => p.id === pilotId);
    if (!pilot) return null;

    const milestone = pilot.milestones.find((m: Milestone) => m.id === milestoneId);
    if (!milestone) return null;

    milestone.trancheDisbursed = true;
    milestone.disbursedAt = new Date().toISOString().split("T")[0];
    setStored(STORAGE_KEYS.PILOTS, pilots);
    return pilot;
  },

  submitMilestoneDeliverable: async (
    pilotId: string,
    milestoneId: string,
    achievedKPI: string,
    fileUrl: string
  ): Promise<Pilot | null> => {
    const pilots = await mockApi.getPilots();
    const pilot = pilots.find((p: Pilot) => p.id === pilotId);
    if (!pilot) return null;

    const milestone = pilot.milestones.find((m: Milestone) => m.id === milestoneId);
    if (!milestone) return null;

    milestone.achievedKPI = achievedKPI;
    milestone.deliverableFileUrl = fileUrl;
    milestone.status = "submitted";
    // Clear old verification stamps on resubmission
    milestone.verifiedBy = undefined;
    milestone.verifiedAt = undefined;
    milestone.verificationRemarks = undefined;
    milestone.verificationReportUrl = undefined;

    setStored(STORAGE_KEYS.PILOTS, pilots);
    return pilot;
  },

  // NLP / Extract
  extractDocumentTags: async (file: File): Promise<DocumentUploadResult> => {
    // Simulates the NLP microservice /extract pipeline
    await new Promise((resolve) => setTimeout(resolve, 800));

    const result: DocumentUploadResult = {
      id: `doc-${Date.now()}`,
      fileName: file.name,
      uploadedAt: new Date().toISOString().split("T")[0],
      extractionStatus: "done",
      skills: [],
      domain: "DroneTech",
      tags: [
        "Computer Vision",
        "Multispectral Imaging",
        "SWIR Sensors",
        "Edge Compute",
        "Autonomous Flight",
        "Encrypted Mesh Telemetry",
        "Thermal Segmentation",
      ],
      summary:
        "Extracted past project experience in autonomous UAV design, infrared optics integration, and edge AI deployment under harsh thermal conditions.",
    };

    // Like the backend: remember the document and merge its tags into the profile.
    const { id, fileName, uploadedAt, extractionStatus } = result;
    const docs = getStored<StartupDocument[]>(STORAGE_KEYS.DOCUMENTS, []);
    setStored(STORAGE_KEYS.DOCUMENTS, [{ id, fileName, uploadedAt, extractionStatus }, ...docs]);
    const profile = await mockApi.getMyProfile();
    setStored(STORAGE_KEYS.PROFILE, {
      ...profile,
      domain: result.domain,
      tags: Array.from(new Set([...profile.tags, ...result.tags])),
    });
    return result;
  },

  // Startup profile (mirrors GET/PATCH /api/startups/me in localStorage)
  getMyProfile: async (): Promise<StartupProfile> => {
    const session = getSession();
    const defaults: StartupProfile = {
      userId: session?.id ?? "user-startup-01",
      startupName: session?.orgName ?? "AeroKisan Technologies Pvt Ltd",
      dpiitNumber: session?.dpiitNumber ?? "DIPP98234",
      dpiitVerified: true,
      domain: "DroneTech",
      turnoverBand: "₹1Cr–₹5Cr",
      location: "Bengaluru, Karnataka",
      incorporationYear: 2022,
      description:
        "DeepTech drone manufacturing company specializing in multispectral canopy-penetrating optical payloads and edge-inference autonomous navigation systems.",
      tags: [
        "Computer Vision",
        "Multispectral Imaging",
        "SWIR Sensors",
        "Edge Compute",
        "Autonomous Flight",
        "Encrypted Mesh Telemetry",
      ],
      skills: [],
      documents: [],
    };
    const stored = getStored<Partial<StartupProfile>>(STORAGE_KEYS.PROFILE, {});
    return {
      ...defaults,
      ...stored,
      documents: getStored<StartupDocument[]>(STORAGE_KEYS.DOCUMENTS, []),
    };
  },

  updateMyProfile: async (changes: StartupProfileUpdate): Promise<StartupProfile> => {
    const { documents, ...current } = await mockApi.getMyProfile();
    const next: Record<string, unknown> = { ...current };
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) delete next[key];
      else if (value !== undefined) next[key] = value;
    }
    setStored(STORAGE_KEYS.PROFILE, next);
    return { ...(next as Omit<StartupProfile, "documents">), documents };
  },

  getMyDocuments: async (): Promise<StartupDocument[]> => {
    return getStored<StartupDocument[]>(STORAGE_KEYS.DOCUMENTS, []);
  },

  // Ranking & eligibility
  rankSolutions: async (problemId: string): Promise<Solution[]> => {
    const solutions = await mockApi.getSolutions(problemId);
    return [...solutions].sort((a, b) => b.matchScore - a.matchScore);
  },

  getEligibility: async (solutionId: string): Promise<Eligibility> => {
    const solution = await mockApi.getSolution(solutionId);
    const problem = solution ? await mockApi.getProblem(solution.problemId) : null;
    const trlNum = (t?: TRL) => (t ? parseInt(t.split("-")[1], 10) : 0);
    const trlOk = !problem || trlNum(solution?.claimedTRL) >= trlNum(problem.targetTRL);
    return {
      solutionId,
      status: trlOk ? "eligible" : "ineligible",
      overallEligible: trlOk,
      checkedAt: new Date().toISOString(),
      rules: [
        {
          rule: "dpiit",
          label: "DPIIT recognition",
          status: "pass",
          reason: `DPIIT number ${solution?.dpiitNumber ?? ""} on record.`,
        },
        {
          rule: "turnover",
          label: "Turnover under ₹25 Cr",
          status: "pass",
          reason: "Declared turnover band is within the startup cap.",
        },
        {
          rule: "domain",
          label: "Domain match",
          status: "pass",
          reason: `Startup domain matches ${problem?.domain ?? "the problem"}.`,
        },
        {
          rule: "trl",
          label: "Technology readiness",
          status: trlOk ? "pass" : "fail",
          reason: trlOk
            ? `Claimed ${solution?.claimedTRL ?? "TRL"} meets the required ${problem?.targetTRL ?? "level"}.`
            : `Claimed ${solution?.claimedTRL} is below the required ${problem?.targetTRL}.`,
        },
      ],
    };
  },

  rerunEligibility: async (solutionId: string): Promise<Eligibility> => {
    return mockApi.getEligibility(solutionId);
  },

  // Scale Solutions & Replication
  getScaleSolutions: async (): Promise<ScaleSolution[]> => {
    return SEED_SCALE_SOLUTIONS;
  },

  getReplications: async (): Promise<ReplicationRequest[]> => {
    return getStored<ReplicationRequest[]>(
      STORAGE_KEYS.REPLICATIONS,
      SEED_REPLICATION_REQUESTS
    );
  },

  createReplicationRequest: async (
    req: Omit<ReplicationRequest, "id" | "requestedAt" | "status">
  ): Promise<ReplicationRequest> => {
    const reps = await mockApi.getReplications();
    const created: ReplicationRequest = {
      ...req,
      id: `rep-${Date.now()}`,
      requestedAt: new Date().toISOString().split("T")[0],
      status: "pending",
    };
    const updated = [created, ...reps];
    setStored(STORAGE_KEYS.REPLICATIONS, updated);
    return created;
  },

  logAuditEntry: async (entry: {
    pilotId: string;
    action: string;
    actorName: string;
    actorRole: string;
    hash?: string;
  }): Promise<void> => {
    const key = `samarth_audit_${entry.pilotId}`;
    const existing = getStored<any[]>(key, []);
    setStored(key, [...existing, { ...entry, timestamp: new Date().toISOString() }]);
  },
};

// ---------------------------------------------------------------------------
// Real implementation: calls the FastAPI backend (backend/docs/api_contract.md).
// Scale, replication and audit methods have no backend endpoints yet, so they
// fall through to the mock via the spread below.
// ---------------------------------------------------------------------------
const enc = encodeURIComponent;

const realApi: ApiService = {
  ...mockApi,

  // Problems
  getProblems: () => apiFetch<Problem[]>("/api/problems"),

  getProblem: (id) => apiFetchOrNull<Problem>(`/api/problems/${enc(id)}`),

  createProblem: (newProblem) => apiFetch<Problem>("/api/problems", { method: "POST", json: newProblem }),

  // Solutions
  getSolutions: (problemId) =>
    // The per-problem route ranks unranked solutions first (for government roles).
    apiFetch<Solution[]>(problemId ? `/api/problems/${enc(problemId)}/solutions` : "/api/solutions"),

  getSolution: (id) => apiFetchOrNull<Solution>(`/api/solutions/${enc(id)}`),

  getProposalsByStartup: (startupId) => apiFetch<Solution[]>(`/api/solutions?startupId=${enc(startupId)}`),

  submitSolution: async (newSolution, file) => {
    if (!file) throw new ApiError(422, "A proposal PDF is required.");
    // Startup name/DPIIT/location come from the caller's profile server-side, so only these are sent.
    const form = new FormData();
    form.append("title", newSolution.title);
    form.append("abstract", newSolution.abstract);
    form.append("claimedTRL", newSolution.claimedTRL);
    form.append("proposedCost", String(newSolution.proposedCost));
    form.append("proposedDurationWeeks", String(newSolution.proposedDurationWeeks));
    form.append("file", file);
    return apiFetch<Solution>(`/api/problems/${enc(newSolution.problemId)}/solutions`, { method: "POST", form });
  },

  updateSolutionStatus: async (solutionId, status) => {
    try {
      return await apiFetch<Solution>(`/api/solutions/${enc(solutionId)}/status`, {
        method: "PATCH",
        json: { status },
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },

  updateSolutionRubric: (solutionId, rubric) =>
    apiFetchOrNull<Solution>(`/api/solutions/${enc(solutionId)}/rubric`, { method: "POST", json: rubric }),

  rankSolutions: (problemId) =>
    apiFetch<Solution[]>(`/api/problems/${enc(problemId)}/solutions/rank`, { method: "POST" }),

  // Pilots & milestones. Every write returns the whole updated Pilot.
  getPilots: () => apiFetch<Pilot[]>("/api/pilots"),

  getPilot: (id) => apiFetchOrNull<Pilot>(`/api/pilots/${enc(id)}`),

  createPilot: (pilotData) =>
    // The backend derives problem, startup, department, lead officer and tranche amounts from
    // the solution, so only what the officer actually chose is sent.
    apiFetch<Pilot>("/api/pilots", {
      method: "POST",
      json: {
        solutionId: pilotData.solutionId,
        independentValidatorName: pilotData.independentValidatorName,
        durationWeeks: pilotData.durationWeeks,
        totalBudget: pilotData.totalBudget,
        milestones: pilotData.milestones.map((m) => ({
          sequence: m.sequence,
          title: m.title,
          description: m.description,
          targetKPI: m.targetKPI,
          deliverableDueWeek: m.deliverableDueWeek,
          tranchePercentage: m.tranchePercentage,
        })),
      },
    }),

  updatePilotStatus: (pilotId, status) =>
    apiFetchOrNull<Pilot>(`/api/pilots/${enc(pilotId)}/status`, { method: "PATCH", json: { status } }),

  verifyMilestone: (pilotId, milestoneId, verifiedBy, remarks, status = "verified", verificationReportUrl) =>
    apiFetchOrNull<Pilot>(`/api/pilots/${enc(pilotId)}/milestones/${enc(milestoneId)}/verify`, {
      method: "PATCH",
      json: { verifiedBy, remarks, status, verificationReportUrl },
    }),

  disburseTranche: (pilotId, milestoneId) =>
    apiFetchOrNull<Pilot>(`/api/pilots/${enc(pilotId)}/milestones/${enc(milestoneId)}/disburse`, {
      method: "PATCH",
    }),

  submitMilestoneDeliverable: (pilotId, milestoneId, achievedKPI, fileUrl) =>
    apiFetchOrNull<Pilot>(`/api/pilots/${enc(pilotId)}/milestones/${enc(milestoneId)}/deliverable`, {
      method: "PATCH",
      json: { achievedKPI, fileUrl },
    }),

  // Eligibility
  getEligibility: (solutionId) => apiFetch<Eligibility>(`/api/solutions/${enc(solutionId)}/eligibility`),

  rerunEligibility: (solutionId) =>
    apiFetch<Eligibility>(`/api/solutions/${enc(solutionId)}/eligibility`, { method: "POST" }),

  // Startup profile & documents
  getMyProfile: () => apiFetch<StartupProfile>("/api/startups/me"),

  updateMyProfile: (changes) => apiFetch<StartupProfile>("/api/startups/me", { method: "PATCH", json: changes }),

  getMyDocuments: () => apiFetch<StartupDocument[]>("/api/startups/me/documents"),

  extractDocumentTags: (file) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<DocumentUploadResult>("/api/startups/me/documents", { method: "POST", form });
  },
};

export const api: ApiService = USE_MOCK_API ? mockApi : realApi;

// ---------------------------------------------------------------------------
// Auth. Every function here stores the session (localStorage + role cookie,
// via setSession) before returning it.
// ---------------------------------------------------------------------------
export interface SignupInput {
  role: Exclude<UserRole, "admin">;
  name: string;
  orgName: string;
  email: string;
  password: string;
  department?: string;
  dpiitNumber?: string;
}

export const authApi = {
  /** `fallbackRole` keeps the old mock behaviour: an unknown email signs in as that role's persona. */
  login: async (email: string, password: string, fallbackRole?: UserRole): Promise<UserSession> => {
    if (USE_MOCK_API) {
      const persona =
        DEMO_PERSONAS.find((p) => p.email.toLowerCase() === email.trim().toLowerCase()) ||
        DEMO_PERSONAS.find((p) => p.role === fallbackRole);
      if (!persona) throw new ApiError(401, "No account found matching credentials.");
      setSession(persona);
      return persona;
    }
    const session = await apiFetch<UserSession>("/api/auth/login", {
      method: "POST",
      json: { email: email.trim(), password },
      auth: false,
    });
    setSession(session);
    return session;
  },

  signup: async (input: SignupInput): Promise<UserSession> => {
    if (USE_MOCK_API) {
      const session: UserSession = {
        id: `user-${Date.now()}`,
        name: input.name,
        email: input.email,
        role: input.role,
        orgName: input.orgName,
        dpiitNumber: input.dpiitNumber,
        department: input.department,
        token: `jwt-${Date.now()}`,
      };
      setSession(session);
      return session;
    }
    const session = await apiFetch<UserSession>("/api/auth/signup", { method: "POST", json: input, auth: false });
    setSession(session);
    return session;
  },

  /** 1-click demo login: the persona itself in mock mode, a real login as a seed.py account otherwise. */
  loginAsPersona: (persona: UserSession): Promise<UserSession> => {
    if (USE_MOCK_API) {
      setSession(persona);
      return Promise.resolve(persona);
    }
    return authApi.login(persona.email, DEMO_PASSWORD);
  },
};
