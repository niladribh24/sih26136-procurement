"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { Pilot } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function StartupPilotsPage() {
  const [pilots, setPilots] = useState<Pilot[]>([]);

  useEffect(() => {
    api.getPilots().then(setPilots);
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        code="STAGE-2-PILOT"
        title="Active Pilot Trials"
        subtitle="Manage field test milestones, upload technical deliverable verification logs, and track tranche disbursements."
      />

      <div className="space-y-4">
        {pilots.map((pilot) => {
          const completedCount = pilot.milestones.filter((m) => m.status === "verified").length;
          const totalCount = pilot.milestones.length;

          return (
            <div
              key={pilot.id}
              className="p-6 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-4 shadow-2xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono-data text-[var(--accent)] font-semibold">
                      {pilot.code}
                    </span>
                    <Badge variant="positive">{pilot.status.toUpperCase()}</Badge>
                    <span className="text-xs text-[var(--ink-muted)] font-mono-data">
                      {pilot.department}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-[var(--ink)] font-editorial">
                    {pilot.startupName} Pilot Trial
                  </h2>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono-data font-bold text-[var(--ink)]">
                    Total Grant: ₹{(pilot.totalBudget / 100000).toFixed(1)}L
                  </span>
                  <div className="text-[11px] font-mono-data text-[var(--ink-muted)]">
                    Duration: {pilot.durationWeeks} Weeks
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-[var(--ink-muted)]">
                  <span>Milestone Progression</span>
                  <span className="font-mono-data">
                    {completedCount} of {totalCount} verified
                  </span>
                </div>
                <div className="w-full h-2 bg-[var(--surface-subtle)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--positive)] transition-all duration-300"
                    style={{ width: `${(completedCount / totalCount) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--line)] text-xs">
                <span className="text-[11px] font-mono-data text-[var(--ink-muted)]">
                  Lead Officer: {pilot.leadOfficerName}
                </span>
                <Link href={`/startup/pilots/${pilot.id}`}>
                  <Button variant="primary" size="sm">
                    <span>Open Pilot Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
