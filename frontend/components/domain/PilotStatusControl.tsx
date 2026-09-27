"use client";

import React, { useState } from "react";
import { AlertCircle, Play, XOctagon, CheckCircle2, ArrowRight } from "lucide-react";
import { Pilot, PilotStatus } from "@/lib/types";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/http";
import { nextStatuses } from "@/lib/pilotStateMachine";
import { Button } from "@/components/ui/Button";

// Procurement moves have their own buttons (page header, sanction docket), so they aren't offered here.
const HANDLED_ELSEWHERE: PilotStatus[] = ["Recommended for procurement", "Procured"];

const ACTION: Partial<Record<PilotStatus, { label: string; icon: React.ReactNode; danger?: boolean }>> = {
  "Under review": { label: "Send for review", icon: <ArrowRight className="w-3.5 h-3.5" /> },
  Approved: { label: "Approve pilot", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  Active: { label: "Start pilot", icon: <Play className="w-3.5 h-3.5" /> },
  Completed: { label: "Mark completed", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  Failed: { label: "Terminate as failed", icon: <XOctagon className="w-3.5 h-3.5" />, danger: true },
};

const EXPLAIN: Partial<Record<PilotStatus, string>> = {
  Proposed: "Awaiting departmental review.",
  "Under review": "Under departmental review.",
  Approved: "Approved, not started. The startup can submit deliverables once the pilot is started; due weeks count from the start date.",
  Active: "Trial running. The pilot completes automatically when every milestone is verified.",
  Completed: "All milestones verified. Recommend it for direct sanction to move to procurement.",
  Failed: "Terminated as failed. This is a final status.",
  "Recommended for procurement": "Recommended for direct sanction. Record the procurement from the sanction docket.",
  Procured: "Procurement recorded; listed as a proven solution for other departments. This is a final status.",
};

export interface PilotStatusControlProps {
  pilot: Pilot;
  onUpdated: (pilot: Pilot) => void;
}

/** The lead officer's status actions: only the moves the state machine allows from here. */
export const PilotStatusControl: React.FC<PilotStatusControlProps> = ({ pilot, onUpdated }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<PilotStatus | null>(null);

  const allVerified = pilot.milestones.length > 0 && pilot.milestones.every((m) => m.status === "verified");
  const options = nextStatuses(pilot.status).filter(
    // "Completed" happens by itself on the last verification; only offer it if that was missed.
    (s) => !HANDLED_ELSEWHERE.includes(s) && (s !== "Completed" || allVerified)
  );

  const move = async (target: PilotStatus) => {
    if (ACTION[target]?.danger && confirming !== target) {
      setConfirming(target);
      return;
    }
    setConfirming(null);
    setError("");
    setBusy(true);
    try {
      const updated = await api.updatePilotStatus(pilot.id, target);
      if (updated) onUpdated(updated);
    } catch (err) {
      setError(errorMessage(err, "Could not change the pilot status."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="text-[11px] font-mono-data text-[var(--ink-muted)] uppercase">Pilot status</span>
          <div className="text-sm font-bold text-[var(--ink)]">{pilot.status}</div>
          <p className="text-xs text-[var(--ink-secondary)]">{EXPLAIN[pilot.status]}</p>
        </div>

        {options.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {options.map((target) => {
              const action = ACTION[target];
              const isConfirming = confirming === target;
              return (
                <Button
                  key={target}
                  variant={action?.danger ? "danger" : "primary"}
                  size="sm"
                  disabled={busy}
                  onClick={() => move(target)}
                >
                  {action?.icon}
                  <span>{isConfirming ? "Confirm: terminate pilot" : action?.label ?? target}</span>
                </Button>
              );
            })}
            {confirming && (
              <Button variant="ghost" size="sm" onClick={() => setConfirming(null)} disabled={busy}>
                Cancel
              </Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-2.5 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-[6px] text-xs text-[var(--danger)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
