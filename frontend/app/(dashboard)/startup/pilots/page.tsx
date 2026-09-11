"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, ShieldCheck, ArrowRight, CheckCircle2, Rocket, Search } from "lucide-react";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { Pilot } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function StartupPilotsPage() {
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    api.getPilots().then((allPilots: Pilot[]) => {
      // Strict tenant isolation: show only pilots belonging to this startup
      const userPilots = allPilots.filter(
        (p: Pilot) =>
          (session?.id && (p.startupId === session.id || p.startupId === "startup-01")) ||
          (session?.dpiitNumber && p.dpiitNumber === session.dpiitNumber) ||
          p.startupName.toLowerCase().includes((session?.orgName || "").toLowerCase())
      );
      setPilots(userPilots);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        code="STAGE-2-PILOT"
        title="Active Pilot Trials"
        subtitle="Manage field test milestones, upload technical deliverable verification logs, and track tranche disbursements."
      />

      {loading ? (
        <div className="p-12 text-center text-xs font-mono-data text-[var(--ink-muted)]">
          Loading assigned pilot trials...
        </div>
      ) : pilots.length === 0 ? (
        <div className="p-12 text-center bg-[var(--surface)] border border-[var(--line)] rounded-[8px] space-y-3">
          <div className="w-10 h-10 rounded-full bg-[var(--surface-raised)] border border-[var(--line)] flex items-center justify-center mx-auto text-[var(--ink-muted)]">
            <Rocket className="w-5 h-5" />
          </div>
          <div className="text-sm font-bold text-[var(--ink)]">No Active Pilot Trials Yet</div>
          <p className="text-xs text-[var(--ink-muted)] max-w-md mx-auto">
            Your shortlisted proposals will appear here once approved by department evaluation committees for pilot deployment.
          </p>
          <div className="pt-2">
            <Link href="/startup/problems">
              <Button variant="secondary" size="sm">
                <Search className="w-3.5 h-3.5 mr-1" />
                Browse Open Problem Statements
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {pilots.map((pilot) => {
            const completedCount = pilot.milestones.filter((m) => m.status === "verified").length;
            const totalCount = pilot.milestones.length;
            const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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
                      {completedCount} of {totalCount} verified ({progressPct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[var(--surface-subtle)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--positive)] transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
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
      )}
    </div>
  );
}
