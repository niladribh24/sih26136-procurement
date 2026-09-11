"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, CheckCircle2, Clock, XCircle, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Solution } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function StartupProposalsPage() {
  const [solutions, setSolutions] = useState<Solution[]>([]);

  useEffect(() => {
    api.getSolutions().then(setSolutions);
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        code="MY-PROPOSALS"
        title="Submitted Technical Proposals"
        subtitle="Track evaluation status, AI semantic match ratings, and pilot shortlisting decisions."
      />

      <div className="space-y-4">
        {solutions.map((sol) => (
          <div
            key={sol.id}
            className="p-6 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-3 shadow-2xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono-data text-[var(--ink-muted)]">
                    Ref: {sol.problemId}
                  </span>
                  <Badge variant={sol.status === "shortlisted" ? "positive" : "warning"}>
                    {sol.status.toUpperCase()}
                  </Badge>
                  <span className="text-xs font-mono-data text-[var(--ink-muted)]">
                    Submitted: {sol.submittedAt}
                  </span>
                </div>
                <h2 className="text-base font-bold text-[var(--ink)] font-editorial">
                  {sol.title}
                </h2>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono-data font-bold text-[var(--highlight)]">
                  Match Score: {Math.round(sol.matchScore * 100)}%
                </span>
                <div className="text-[11px] font-mono-data text-[var(--ink-muted)]">
                  Proposed: ₹{(sol.proposedCost / 100000).toFixed(1)}L ({sol.proposedDurationWeeks} wks)
                </div>
              </div>
            </div>

            <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
              {sol.abstract}
            </p>

            {sol.matchedKeywords && sol.matchedKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {sol.matchedKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 rounded-[4px] bg-[var(--highlight-soft)] text-[var(--highlight)] text-[11px] font-mono-data"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-[var(--line)] text-xs">
              <span className="text-[11px] font-mono-data text-[var(--ink-muted)]">
                TRL Claimed: {sol.claimedTRL} · Evaluator Rubric: {sol.rubricScore ? `${sol.rubricScore.total}/100` : "Under Scoring"}
              </span>
              {sol.status === "shortlisted" && (
                <Link href="/startup/pilots">
                  <Button variant="primary" size="sm">
                    <span>View Active Pilot Status</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
