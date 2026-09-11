"use client";

import React from "react";
import { Check, Clock } from "lucide-react";
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
    label: "Field Sandbox Trial",
    description: "Milestone execution & deliverable tests",
  },
  {
    number: 2,
    label: "Independent Verification",
    description: "Evaluator audit & criteria compliance",
  },
  {
    number: 3,
    label: "Sanction Recommendation",
    description: "Department lead officer sign-off",
  },
  {
    number: 4,
    label: "Direct Procurement",
    description: "GFR 194 sanction memorandum",
  },
];

export const MilestoneStepper: React.FC<MilestoneStepperProps> = ({
  currentStatus,
  leadOfficer,
  independentValidator,
}) => {
  // Determine current active step index (0-based: 0 to 3)
  let activeIndex = 0;
  if (currentStatus === "Completed") {
    activeIndex = 1;
  } else if (currentStatus === "Recommended for procurement") {
    activeIndex = 2;
  } else if (currentStatus === "Procured") {
    activeIndex = 3;
  }

  const isProcured = currentStatus === "Procured";

  return (
    <div className="p-5 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
        <div>
          <span className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--ink-muted)] block">
            GFR Pilot Lifecycle Progression
          </span>
          <h3 className="text-sm font-bold text-[var(--ink)] font-editorial">
            Current Stage: <span className="text-[var(--accent)] capitalize">{currentStatus}</span>
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
          const isPassed = isProcured ? true : idx < activeIndex;
          const isCurrent = isProcured ? idx === 3 : idx === activeIndex;

          return (
            <div
              key={step.number}
              className={`p-3 rounded-[6px] border transition-all flex flex-col justify-between gap-2 ${
                isCurrent
                  ? "bg-[var(--surface)] border-[var(--accent)] ring-1 ring-[var(--accent)]/20 shadow-xs"
                  : isPassed
                  ? "bg-[var(--positive-soft)]/40 border-[var(--positive)]/30 text-[var(--ink)]"
                  : "bg-[var(--surface-subtle)] border-[var(--line)] text-[var(--ink-muted)] opacity-75"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono-data font-bold ${
                    isPassed
                      ? "bg-[var(--positive)] text-white"
                      : isCurrent
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface-raised)] border border-[var(--line)] text-[var(--ink-muted)]"
                  }`}
                >
                  {isPassed ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : step.number}
                </span>

                <span className="text-[10px] font-mono-data uppercase font-semibold">
                  {isPassed ? (
                    <span className="text-[var(--positive)]">Completed</span>
                  ) : isCurrent ? (
                    <span className="text-[var(--accent)] flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-pulse" /> Active
                    </span>
                  ) : (
                    <span className="text-[var(--ink-muted)]">Upcoming</span>
                  )}
                </span>
              </div>

              <div>
                <div
                  className={`text-xs font-bold leading-snug ${
                    isCurrent ? "text-[var(--ink)]" : isPassed ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"
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
