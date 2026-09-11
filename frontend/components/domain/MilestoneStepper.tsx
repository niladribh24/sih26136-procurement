"use client";

import React from "react";
import { Check, ShieldCheck, Clock, Award } from "lucide-react";
import { PilotStatus } from "@/lib/types";

export interface MilestoneStepperProps {
  currentStatus: PilotStatus;
  leadOfficer: string;
  independentValidator: string;
}

const STAGES: PilotStatus[] = [
  "Proposed",
  "Under review",
  "Approved",
  "Active",
  "Completed",
  "Recommended for procurement",
];

export const MilestoneStepper: React.FC<MilestoneStepperProps> = ({
  currentStatus,
  leadOfficer,
  independentValidator,
}) => {
  const currentIndex = STAGES.indexOf(currentStatus);

  return (
    <div className="p-6 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
        <div>
          <span className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--ink-muted)] block">
            GFR Pilot State Machine
          </span>
          <h3 className="text-sm font-bold text-[var(--ink)] font-editorial">
            Current Stage: <span className="text-[var(--accent)] capitalize">{currentStatus}</span>
          </h3>
        </div>

        <div className="text-xs font-mono-data text-[var(--ink-muted)] space-y-0.5 sm:text-right">
          <div>
            Lead Officer: <strong className="text-[var(--ink)]">{leadOfficer}</strong>
          </div>
          <div>
            Independent Validator: <strong className="text-[var(--ink)]">{independentValidator}</strong>
          </div>
        </div>
      </div>

      {/* Visual Stepper */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {STAGES.map((stage, idx) => {
          const isPassed = idx < currentIndex || currentStatus === "Procured";
          const isCurrent = stage === currentStatus;

          return (
            <React.Fragment key={stage}>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border text-xs font-mono-data transition-colors ${
                  isCurrent
                    ? "bg-[var(--accent)] text-white border-[var(--accent)] font-bold shadow-xs"
                    : isPassed
                    ? "bg-[var(--positive-soft)] text-[var(--positive)] border-[var(--positive)]/30 font-medium"
                    : "bg-[var(--surface)] text-[var(--ink-muted)] border-[var(--line)]"
                }`}
              >
                {isPassed && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                {isCurrent && <Clock className="w-3.5 h-3.5 animate-pulse" />}
                <span>{stage}</span>
              </div>

              {idx < STAGES.length - 1 && (
                <span className="text-[var(--ink-faint)] text-xs">──▶</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
