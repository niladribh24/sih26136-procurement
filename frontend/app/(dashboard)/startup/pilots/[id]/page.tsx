"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  ShieldCheck,
  FileUp,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Calendar,
  IndianRupee,
} from "lucide-react";
import { api } from "@/lib/api";
import { Pilot, Milestone } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";

export default function StartupPilotDetailPage() {
  const params = useParams();
  const pilotId = params.id as string;

  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [loading, setLoading] = useState(true);

  // Deliverable Upload Modal State
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);
  const [achievedKPI, setAchievedKPI] = useState("");
  const [fileName, setFileName] = useState("Field_Trial_Run_Logs.pdf");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.getPilot(pilotId).then((data: Pilot | null) => {
      setPilot(data);
      setLoading(false);
    });
  }, [pilotId]);

  const handleOpenUpload = (milestone: Milestone) => {
    setActiveMilestone(milestone);
    setAchievedKPI(milestone.achievedKPI || "");
  };

  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pilot || !activeMilestone) return;

    setIsSubmitting(true);
    try {
      const updated = await api.submitMilestoneDeliverable(
        pilot.id,
        activeMilestone.id,
        achievedKPI || "Target criteria satisfied as verified in attached test report.",
        `/deliverables/${fileName}`
      );
      if (updated) setPilot({ ...updated });
      setActiveMilestone(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-[var(--ink-muted)]">Loading pilot workspace...</div>;
  }

  if (!pilot) {
    return <div className="p-8 text-center text-xs text-[var(--ink)]">Pilot record not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/startup/pilots"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)] hover:text-[var(--accent)] font-medium"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to My Pilots</span>
      </Link>

      <PageHeader
        code={pilot.code}
        title={`${pilot.startupName} — Field Pilot Workspace`}
        subtitle={`${pilot.department} · ${pilot.ministry}`}
        badge={<Badge variant="positive">{pilot.status.toUpperCase()}</Badge>}
      />

      {/* State Machine Progression Banner */}
      <div className="p-4 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-2">
        <span className="text-[11px] font-mono-data text-[var(--ink-muted)] uppercase tracking-wider">
          State Machine Progression
        </span>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono-data">
          {[
            "Proposed",
            "Under review",
            "Approved",
            "Active",
            "Completed",
            "Recommended for procurement",
            "Procured",
          ].map((st, idx, arr) => {
            const currentIdx = arr.indexOf(pilot.status);
            const isCurrent = pilot.status === st;
            const isPassed = currentIdx > idx || pilot.status === "Procured";

            return (
              <React.Fragment key={st}>
                <span
                  className={`px-2.5 py-1 rounded-[4px] border ${
                    isCurrent
                      ? "bg-[var(--accent)] text-white border-[var(--accent)] font-bold shadow-xs"
                      : isPassed
                      ? "bg-[var(--positive-soft)] text-[var(--positive)] border-[var(--positive)]/30 font-medium"
                      : "bg-[var(--surface-subtle)] text-[var(--ink-muted)] border-[var(--line)]"
                  }`}
                >
                  {isPassed && "✓ "}
                  {st}
                </span>
                {idx < arr.length - 1 && <span className="text-[var(--ink-faint)]">──▶</span>}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Milestones List */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-[var(--ink)] font-editorial">
          Milestone Deliverables & Tranche Schedule
        </h3>

        {pilot.milestones.map((milestone) => (
          <div
            key={milestone.id}
            className="p-6 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-4 shadow-2xs"
          >
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
                        : milestone.status === "failed"
                        ? "danger"
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
                  ₹{(milestone.trancheAmount / 100000).toFixed(2)}L
                </span>
                <div className="text-[11px] font-mono-data text-[var(--ink-muted)]">
                  Tranche: {milestone.tranchePercentage}% of grant
                </div>
              </div>
            </div>

            <p className="text-xs text-[var(--ink-secondary)]">
              {milestone.description}
            </p>

            <div className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-[6px] space-y-1 text-xs">
              <div className="text-[11px] font-mono-data text-[var(--ink-muted)] uppercase">
                Target KPI Metric
              </div>
              <div className="font-semibold text-[var(--ink)]">{milestone.targetKPI}</div>

              {milestone.achievedKPI && (
                <div className="pt-2 border-t border-[var(--line)] mt-2">
                  <span className="text-[11px] font-mono-data text-[var(--accent)] uppercase font-bold">
                    Reported Benchmark:{" "}
                  </span>
                  <span className="text-[var(--ink)] font-mono-data">
                    {milestone.achievedKPI}
                  </span>
                </div>
              )}
            </div>

            {milestone.status === "verified" && milestone.verificationRemarks && (
              <div className="p-3 bg-[var(--positive-soft)] border border-[var(--positive)]/30 rounded-[6px] text-xs text-[var(--positive)]">
                <div className="font-bold font-mono-data">
                  Independent Verification Sign-off Recorded by {milestone.verifiedBy} ({milestone.verifiedAt}):
                </div>
                <p className="mt-1 text-[11px] leading-relaxed">{milestone.verificationRemarks}</p>
              </div>
            )}

            {milestone.status === "failed" && milestone.verificationRemarks && (
              <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-[6px] text-xs text-[var(--danger)]">
                <div className="font-bold font-mono-data">
                  Discrepancy Flagged by Independent Validator ({milestone.verifiedAt || "Audit Rejection"}):
                </div>
                <p className="mt-1 text-[11px] leading-relaxed">{milestone.verificationRemarks}</p>
                <div className="text-[10px] uppercase font-mono-data font-semibold mt-1">
                  Action Required: Rectify benchmark telemetry and re-upload deliverable.
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
              <div className="text-[11px] font-mono-data text-[var(--ink-muted)]">
                {milestone.deliverableFileUrl ? (
                  <a
                    href={milestone.deliverableFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] underline hover:text-[var(--accent-hover)]"
                  >
                    Attached: {milestone.deliverableFileUrl}
                  </a>
                ) : (
                  <span>No file attached yet</span>
                )}
              </div>

              {milestone.status !== "verified" && (
                <Button
                  variant={milestone.status === "failed" ? "danger" : milestone.status === "submitted" ? "secondary" : "primary"}
                  size="sm"
                  onClick={() => handleOpenUpload(milestone)}
                >
                  <FileUp className="w-3.5 h-3.5" />
                  <span>
                    {milestone.status === "submitted"
                      ? "Re-upload Deliverable"
                      : milestone.status === "failed"
                      ? "Re-submit Rectified Deliverable"
                      : "Upload Deliverable & Log KPI"}
                  </span>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Deliverable Modal */}
      {activeMilestone && (
        <Dialog
          isOpen={true}
          onClose={() => setActiveMilestone(null)}
          title={`Submit Milestone ${activeMilestone.sequence} Deliverable`}
          description={activeMilestone.title}
        >
          <form onSubmit={handleSubmitDeliverable} className="space-y-4">
            <Input
              label="Achieved KPI Benchmark Metric"
              placeholder="e.g. 5.4% false-positive rate observed across 18 flight passes"
              value={achievedKPI}
              onChange={(e) => setAchievedKPI(e.target.value)}
              required
            />

            <div className="border border-dashed border-[var(--line-strong)] rounded-[6px] p-4 bg-[var(--surface)] text-center">
              <FileUp className="w-6 h-6 text-[var(--accent)] mx-auto mb-1" />
              <div className="text-xs font-medium text-[var(--ink)] font-mono-data">
                {fileName}
              </div>
              <input
                type="file"
                id="modal-pdf-file"
                accept=".pdf,.zip"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setFileName(e.target.files[0].name);
                  }
                }}
                className="hidden"
              />
              <label
                htmlFor="modal-pdf-file"
                className="inline-block mt-2 text-[11px] text-[var(--accent)] font-semibold underline cursor-pointer"
              >
                Choose Deliverable Archive / PDF
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--line)]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setActiveMilestone(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit for Verification"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
