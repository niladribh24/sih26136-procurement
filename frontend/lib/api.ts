"use client";

import {
  Problem,
  Solution,
  Pilot,
  Milestone,
  ReplicationRequest,
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
  STARTUP_TAGS: "samarth_store_startup_tags",
};

function getStored<T>(key: string, defaultData: T): T {
  if (typeof window === "undefined") return defaultData;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultData));
      return defaultData;
    }
    return JSON.parse(raw);
  } catch {
    return defaultData;
  }
}

function setStored<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

export const api = {
  // Problems
  getProblems: async (): Promise<Problem[]> => {
    return getStored<Problem[]>(STORAGE_KEYS.PROBLEMS, SEED_PROBLEMS);
  },

  getProblem: async (id: string): Promise<Problem | null> => {
    const problems = await api.getProblems();
    return problems.find((p) => p.id === id || p.code === id) || null;
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
    return solutions.find((s) => s.id === id) || null;
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
    const targetProblem = problems.find((p) => p.id === newSolution.problemId);
    if (targetProblem) {
      targetProblem.submissionCount += 1;
      setStored(STORAGE_KEYS.PROBLEMS, problems);
    }

    return created;
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
    const sol = solutions.find((s) => s.id === solutionId);
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
    return pilots.find((p) => p.id === id || p.code === id) || null;
  },

  createPilot: async (pilotData: Omit<Pilot, "id" | "code" | "startDate" | "status">): Promise<Pilot> => {
    const pilots = await api.getPilots();
    const created: Pilot = {
      ...pilotData,
      id: `plt-${Date.now()}`,
      code: `PLT-2026-${Math.floor(10 + Math.random() * 90)}`,
      startDate: new Date().toISOString().split("T")[0],
      status: "Proposed",
    };

    const updated = [created, ...pilots];
    setStored(STORAGE_KEYS.PILOTS, updated);
    return created;
  },

  updatePilotStatus: async (pilotId: string, status: Pilot["status"]): Promise<Pilot | null> => {
    const pilots = await api.getPilots();
    const pilot = pilots.find((p) => p.id === pilotId);
    if (!pilot) return null;
    pilot.status = status;
    setStored(STORAGE_KEYS.PILOTS, pilots);
    return pilot;
  },

  verifyMilestone: async (
    pilotId: string,
    milestoneId: string,
    verifiedBy: string,
    remarks: string
  ): Promise<Pilot | null> => {
    const pilots = await api.getPilots();
    const pilot = pilots.find((p) => p.id === pilotId);
    if (!pilot) return null;

    const milestone = pilot.milestones.find((m) => m.id === milestoneId);
    if (!milestone) return null;

    milestone.status = "verified";
    milestone.verifiedBy = verifiedBy;
    milestone.verifiedAt = new Date().toISOString().replace("T", " ").substring(0, 19) + " IST";
    milestone.verificationRemarks = remarks;

    // Check if all milestones are verified
    const allVerified = pilot.milestones.every((m) => m.status === "verified");
    if (allVerified) {
      pilot.status = "Completed";
    }

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
    const pilot = pilots.find((p) => p.id === pilotId);
    if (!pilot) return null;

    const milestone = pilot.milestones.find((m) => m.id === milestoneId);
    if (!milestone) return null;

    milestone.achievedKPI = achievedKPI;
    milestone.deliverableFileUrl = fileUrl;
    milestone.status = "submitted";

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
  getScaleSolutions: async () => {
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
};
