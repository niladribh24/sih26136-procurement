"use client";

import {
  Problem,
  Solution,
  Pilot,
  Milestone,
  ReplicationRequest,
  ScaleSolution,
} from "./types";
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

export interface ApiService {
  getProblems: () => Promise<Problem[]>;
  getProblem: (id: string) => Promise<Problem | null>;
  getProblemById: (id: string) => Promise<Problem | null>;
  createProblem: (newProblem: Omit<Problem, "id" | "code" | "createdAt" | "submissionCount" | "status">) => Promise<Problem>;
  getSolutions: (problemId?: string) => Promise<Solution[]>;
  getSolution: (id: string) => Promise<Solution | null>;
  getProposalsByStartup: (startupId: string) => Promise<Solution[]>;
  submitSolution: (newSolution: Omit<Solution, "id" | "submittedAt" | "matchScore" | "matchExplanation" | "matchedKeywords" | "status">) => Promise<Solution>;
  submitProposal: (proposal: Omit<Solution, "id" | "submittedAt" | "matchScore" | "matchExplanation" | "matchedKeywords" | "status">) => Promise<Solution>;
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
  getPilotById: (id: string) => Promise<Pilot | null>;
  createPilot: (pilotData: Omit<Pilot, "id" | "code" | "startDate" | "status">) => Promise<Pilot>;
  createPilotFromProposal: (pilotData: Omit<Pilot, "id" | "code" | "startDate" | "status">) => Promise<Pilot>;
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
  extractDocumentTags: (fileName: string) => Promise<{ domain: string; tags: string[]; summary: string }>;
  getScaleSolutions: () => Promise<ScaleSolution[]>;
  getReplications: () => Promise<ReplicationRequest[]>;
  createReplicationRequest: (req: Omit<ReplicationRequest, "id" | "requestedAt" | "status">) => Promise<ReplicationRequest>;
  submitReplicationRequest: (req: Omit<ReplicationRequest, "id" | "requestedAt" | "status">) => Promise<ReplicationRequest>;
  logAuditEntry: (entry: {
    pilotId: string;
    action: string;
    actorName: string;
    actorRole: string;
    hash?: string;
  }) => Promise<void>;
}

export const api: ApiService = {
  // Problems
  getProblems: async (): Promise<Problem[]> => {
    return getStored<Problem[]>(STORAGE_KEYS.PROBLEMS, SEED_PROBLEMS);
  },

  getProblem: async (id: string): Promise<Problem | null> => {
    const problems = await api.getProblems();
    return problems.find((p) => p.id === id || p.code === id) || null;
  },

  getProblemById: async (id: string): Promise<Problem | null> => {
    return api.getProblem(id);
  },

  createProblem: async (newProblem: Omit<Problem, "id" | "code" | "createdAt" | "submissionCount" | "status">): Promise<Problem> => {
    const problems = await api.getProblems();
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
    const solutions = await api.getSolutions();
    return solutions.find((s: Solution) => s.id === id) || null;
  },

  getProposalsByStartup: async (startupId: string): Promise<Solution[]> => {
    const solutions = await api.getSolutions();
    return solutions.filter((s: Solution) => s.startupId === startupId);
  },

  submitSolution: async (newSolution: Omit<Solution, "id" | "submittedAt" | "matchScore" | "matchExplanation" | "matchedKeywords" | "status">): Promise<Solution> => {
    const solutions = await api.getSolutions();

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
    const problems = await api.getProblems();
    const targetProblem = problems.find((p: Problem) => p.id === newSolution.problemId);
    if (targetProblem) {
      targetProblem.submissionCount += 1;
      setStored(STORAGE_KEYS.PROBLEMS, problems);
    }

    return created;
  },

  submitProposal: async (proposal: Parameters<typeof api.submitSolution>[0]): Promise<Solution> => {
    return api.submitSolution(proposal);
  },

  updateSolutionStatus: async (solutionId: string, status: Solution["status"]): Promise<Solution | null> => {
    const solutions = await api.getSolutions();
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
    const solutions = await api.getSolutions();
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
    const pilots = await api.getPilots();
    return pilots.find((p: Pilot) => p.id === id || p.code === id) || null;
  },

  getPilotById: async (id: string): Promise<Pilot | null> => {
    return api.getPilot(id);
  },

  createPilot: async (pilotData: Omit<Pilot, "id" | "code" | "startDate" | "status">): Promise<Pilot> => {
    const pilots = await api.getPilots();
    const pilotId = `plt-${Date.now()}`;
    const created: Pilot = {
      ...pilotData,
      id: pilotId,
      code: `PLT-2026-${Math.floor(10 + Math.random() * 90)}`,
      startDate: new Date().toISOString().split("T")[0],
      status: "Active",
      milestones: (pilotData.milestones || []).map((m: any) => ({
        ...m,
        pilotId,
      })),
    };

    const updated = [created, ...pilots];
    setStored(STORAGE_KEYS.PILOTS, updated);

    // Update parent problem status to "pilot_active"
    if (pilotData.problemId) {
      const problems = await api.getProblems();
      const problem = problems.find((p: Problem) => p.id === pilotData.problemId);
      if (problem) {
        problem.status = "pilot_active";
        setStored(STORAGE_KEYS.PROBLEMS, problems);
      }
    }

    return created;
  },

  createPilotFromProposal: async (pilotData: Omit<Pilot, "id" | "code" | "startDate" | "status">): Promise<Pilot> => {
    return api.createPilot(pilotData);
  },

  updatePilotStatus: async (pilotId: string, status: Pilot["status"]): Promise<Pilot | null> => {
    const pilots = await api.getPilots();
    const pilot = pilots.find((p: Pilot) => p.id === pilotId);
    if (!pilot) return null;
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
    const pilots = await api.getPilots();
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
    const pilots = await api.getPilots();
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
    const pilots = await api.getPilots();
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
  extractDocumentTags: async (
    fileName: string
  ): Promise<{ domain: string; tags: string[]; summary: string }> => {
    // Simulates the NLP microservice /extract pipeline
    await new Promise((resolve) => setTimeout(resolve, 800));

    return {
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
    const reps = await api.getReplications();
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

  submitReplicationRequest: async (
    req: Omit<ReplicationRequest, "id" | "requestedAt" | "status">
  ): Promise<ReplicationRequest> => {
    return api.createReplicationRequest(req);
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
