"use client";

import React from "react";
import { Check, Clock, X } from "lucide-react";
import { PilotStatus } from "@/lib/types";

export interface MilestoneStepperProps {
  currentStatus: PilotStatus;
  leadOfficer?: string;
  independentValidator?: string;
}

interface StepDef {
  number: number;
  label: string;
  description: string;
}

const STEPS: StepDef[] = [
  {
    number: 1,
    label: "Pilot Approval",
    description: "Proposal approved; milestones & tranches configured",
  },
  {
    number: 2,
    label: "Field Trial & Verification",
    description: "Deliverables verified by the independent validator",
  },
  {
    number: 3,
    label: "Sanction Recommendation",
    description: "Lead officer recommends direct procurement",
  },
  {
    number: 4,
    label: "Direct Procurement",
    description: "Procurement recorded under GFR Rule 194",
  },
];

// The step each pilot status is currently on (0-based). Procured has finished all four.
const CURRENT_STEP: Record<PilotStatus, number> = {
  Proposed: 0,
  "Under review": 0,
  Approved: 0,
  Active: 1,
  Failed: 1,
  Completed: 2,
  "Recommended for procurement": 3,
  Procured: 4,
};

type StepState = "done" | "current" | "failed" | "upcoming";

export const MilestoneStepper: React.FC<MilestoneStepperProps> = ({
  currentStatus,
  leadOfficer,
  independentValidator,
}) => {
  const activeIndex = CURRENT_STEP[currentStatus] ?? 0;
  const isFailed = currentStatus === "Failed";

  const stateOf = (idx: number): StepState =>
    idx < activeIndex ? "done" : idx === activeIndex ? (isFailed ? "failed" : "current") : "upcoming";

  return (
    <div className="p-5 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
        <div>
          <span className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--ink-muted)] block">
            GFR Pilot Lifecycle Progression
          </span>
          <h3 className="text-sm font-bold text-[var(--ink)] font-editorial">
            Current Status:{" "}
            <span className={isFailed ? "text-[var(--danger)]" : "text-[var(--accent)]"}>{currentStatus}</span>
          </h3>
        </div>

        {(leadOfficer || independentValidator) && (
          <div className="text-xs font-mono-data text-[var(--ink-muted)] space-y-0.5 sm:text-right">
            {leadOfficer && (
              <div>
                Lead Officer: <strong className="text-[var(--ink)]">{leadOfficer}</strong>
              </div>
            )}
            {independentValidator && (
              <div>
                Independent Validator: <strong className="text-[var(--ink)]">{independentValidator}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4-Step Responsive Stepper Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        {STEPS.map((step, idx) => {
          const state = stateOf(idx);

          return (
            <div
              key={step.number}
              className={`p-3 rounded-[6px] border transition-colors flex flex-col justify-between gap-2 ${
                state === "current"
                  ? "bg-[var(--surface)] border-[var(--accent)] ring-1 ring-[var(--accent)]/20 shadow-xs"
                  : state === "failed"
                  ? "bg-[var(--danger-soft)] border-[var(--danger)]/40"
                  : state === "done"
                  ? "bg-[var(--positive-soft)]/40 border-[var(--positive)]/30 text-[var(--ink)]"
                  : "bg-[var(--surface-subtle)] border-[var(--line)] text-[var(--ink-muted)] opacity-75"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono-data font-bold ${
                    state === "done"
                      ? "bg-[var(--positive)] text-white"
                      : state === "current"
                      ? "bg-[var(--accent)] text-white"
                      : state === "failed"
                      ? "bg-[var(--danger)] text-white"
                      : "bg-[var(--surface-raised)] border border-[var(--line)] text-[var(--ink-muted)]"
                  }`}
                >
                  {state === "done" ? (
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : state === "failed" ? (
                    <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : (
                    step.number
                  )}
                </span>

                <span className="text-[10px] font-mono-data uppercase font-semibold">
                  {state === "done" ? (
                    <span className="text-[var(--positive)]">Completed</span>
                  ) : state === "current" ? (
                    <span className="text-[var(--accent)] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> In progress
                    </span>
                  ) : state === "failed" ? (
                    <span className="text-[var(--danger)]">Failed</span>
                  ) : (
                    <span className="text-[var(--ink-muted)]">Upcoming</span>
                  )}
                </span>
              </div>

              <div>
                <div
                  className={`text-xs font-bold leading-snug ${
                    state === "upcoming" ? "text-[var(--ink-muted)]" : "text-[var(--ink)]"
                  }`}
                >
                  {step.label}
                </div>
                <div className="text-[10px] text-[var(--ink-muted)] leading-tight mt-0.5">
                  {step.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
