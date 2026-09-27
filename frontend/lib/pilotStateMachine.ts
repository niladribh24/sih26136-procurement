import { PilotStatus } from "./types";

/**
 * Legal pilot status moves. A copy of TRANSITIONS in
 * backend/app/services/pilot_state_machine.py (the backend enforces it; this copy lets the
 * UI offer only legal moves). Keep the two in sync.
 */
export const PILOT_TRANSITIONS: Record<PilotStatus, PilotStatus[]> = {
  Proposed: ["Under review"],
  "Under review": ["Approved"],
  Approved: ["Active"],
  Active: ["Completed", "Failed"],
  Completed: ["Recommended for procurement"],
  "Recommended for procurement": ["Procured"],
  Failed: [],
  Procured: [],
};

export function nextStatuses(current: PilotStatus): PilotStatus[] {
  return PILOT_TRANSITIONS[current] ?? [];
}

export function canTransition(current: PilotStatus, target: PilotStatus): boolean {
  return nextStatuses(current).includes(target);
}

/** Which of the four lifecycle stages (Identify → Pilot → Procure → Scale) a pilot is in. */
export function stageBadge(status: PilotStatus): { number: 2 | 3 | 4; label: string } {
  switch (status) {
    case "Completed":
    case "Recommended for procurement":
      return { number: 3, label: "Stage 3: Procure" };
    case "Procured":
      return { number: 4, label: "Stage 4: Scale" };
    default:
      return { number: 2, label: "Stage 2: Pilot" };
  }
}

/** Direct sanction needs a completed trial: every milestone independently verified. */
export function directSanctionEligible(status: PilotStatus): boolean {
  return status === "Completed" || status === "Recommended for procurement" || status === "Procured";
}
