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
