"use client";

import React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  FileText,
  IndianRupee,
  AlertCircle,
  FileCheck,
} from "lucide-react";
import { Milestone } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface MilestoneCardProps {
  milestone: Milestone;
  onVerify: (milestone: Milestone) => void;
  canVerify?: boolean;
}

export const MilestoneCard: React.FC<MilestoneCardProps> = ({
  milestone,
  onVerify,
  canVerify = true,
}) => {
  return (
    <div className="p-6 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono-data font-bold text-[var(--accent)]">
              Milestone {milestone.sequence}
            </span>
            <Badge
              variant={
                milestone.status === "verified"
                  ? "positive"
                  : milestone.status === "submitted"
                  ? "warning"
                  : "default"
              }
            >
              {milestone.status.toUpperCase()}
            </Badge>
            <span className="text-xs font-mono-data text-[var(--ink-muted)]">
              Due Week {milestone.deliverableDueWeek}
            </span>
          </div>
          <h4 className="text-base font-bold text-[var(--ink)]">
            {milestone.title}
          </h4>
        </div>

        <div className="text-right">
          <span className="text-sm font-bold font-mono-data text-[var(--ink)]">
            ₹{(milestone.trancheAmount / 100000).toFixed(2)} Lakhs
          </span>
          <div className="text-[11px] font-mono-data text-[var(--ink-muted)]">
            Tranche: {milestone.tranchePercentage}% of sanction
          </div>
        </div>
      </div>

      <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
        {milestone.description}
      </p>

      {/* KPI Evaluation Box */}
      <div className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-[6px] space-y-2 text-xs">
        <div>
          <span className="text-[10px] font-mono-data text-[var(--ink-muted)] uppercase block">
            Target KPI Specification:
          </span>
          <span className="font-semibold text-[var(--ink)]">{milestone.targetKPI}</span>
        </div>

        {milestone.achievedKPI ? (
          <div className="pt-2 border-t border-[var(--line)]">
            <span className="text-[10px] font-mono-data text-[var(--accent)] uppercase font-bold block">
              Vendor Achieved Benchmark (Logged):
            </span>
            <span className="text-[var(--ink)] font-mono-data">
              {milestone.achievedKPI}
            </span>
          </div>
        ) : (
          <div className="pt-2 border-t border-[var(--line)] text-[11px] text-[var(--ink-muted)] italic">
            Pending vendor test run logs.
          </div>
        )}
      </div>

      {/* Verification Audit Stamp */}
      {milestone.status === "verified" && (
        <div className="p-3 bg-[var(--positive-soft)] border border-[var(--positive)]/30 rounded-[6px] text-xs text-[var(--positive)] space-y-1">
          <div className="flex items-center gap-1.5 font-bold font-mono-data">
            <ShieldCheck className="w-4 h-4" />
            <span>
              Verified by {milestone.verifiedBy} ({milestone.verifiedAt})
            </span>
          </div>
          {milestone.verificationRemarks && (
            <p className="text-[11px] leading-relaxed pl-5.5">
              &quot;{milestone.verificationRemarks}&quot;
            </p>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--line)] text-xs">
        <span className="text-[11px] font-mono-data text-[var(--ink-muted)]">
          {milestone.deliverableFileUrl ? (
            <span className="text-[var(--accent)] underline cursor-pointer">
              {milestone.deliverableFileUrl}
            </span>
          ) : (
            "Awaiting file upload"
          )}
        </span>

        {milestone.status !== "verified" && canVerify && (
          <Button
            variant={milestone.status === "submitted" ? "primary" : "secondary"}
            size="sm"
            onClick={() => onVerify(milestone)}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>
              {milestone.status === "submitted"
                ? "Verify Deliverable & Release Tranche"
                : "Record Pre-Verification Audit"}
            </span>
          </Button>
        )}
      </div>
    </div>
  );
};
