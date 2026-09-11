"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { FileText, CheckCircle2, Clock, XCircle, ArrowRight, AlertCircle, Compass } from "lucide-react";
import { api } from "@/lib/api";
import { Solution } from "@/lib/types";
import { getSession, subscribeSession } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const getServerSnapshot = () => null;

export default function StartupProposalsPage() {
  const session = useSyncExternalStore(subscribeSession, getSession, getServerSnapshot);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getSolutions()
      .then((all: Solution[]) => {
        const active = getSession();
        if (active?.role === "startup") {
          const tenantFiltered = all.filter(
            (s: Solution) =>
              s.startupId === active.id ||
              s.startupName.toLowerCase() === (active.orgName || "").toLowerCase() ||
              (active.dpiitNumber && s.dpiitNumber === active.dpiitNumber)
          );
          setSolutions(tenantFiltered);
        } else {
          setSolutions(all);
        }
      })
      .catch((err: unknown) => console.error("Failed to load proposals", err))
      .finally(() => setLoading(false));
  }, [session?.id]);

  const getStatusBadge = (status: Solution["status"]) => {
    switch (status) {
      case "shortlisted":
        return <Badge variant="positive">SHORTLISTED</Badge>;
      case "rejected":
        return <Badge variant="danger">REJECTED</Badge>;
      case "under_review":
        return <Badge variant="info">UNDER REVIEW</Badge>;
      default:
        return <Badge variant="warning">SUBMITTED</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        code="MY-PROPOSALS"
        title="Submitted Technical Proposals"
        subtitle="Track evaluation status, technical fit scores, and pilot shortlisting decisions."
      />

      {loading ? (
        <div className="p-12 text-center text-xs text-[var(--ink-muted)] flex items-center justify-center gap-2">
          <Clock className="w-4 h-4 animate-spin" />
          <span>Loading submitted proposals...</span>
        </div>
      ) : solutions.length === 0 ? (
        <div className="p-12 text-center bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-3">
          <img src="/empty-dossier.svg" alt="No Proposals Submitted" className="w-24 h-24 mx-auto mb-2 opacity-85" />
          <h3 className="text-base font-bold text-[var(--ink)] font-editorial">
            No Proposals Submitted Yet
          </h3>
          <p className="text-xs text-[var(--ink-muted)] max-w-md mx-auto">
            Your entity has not submitted any technical proposals to open challenges yet. Explore live government problem statements to participate.
          </p>
          <div className="pt-2">
            <Link href="/startup/problems">
              <Button variant="primary" size="sm">
                <Compass className="w-3.5 h-3.5 mr-1.5" />
                Browse Open Government Challenges
              </Button>
            </Link>
          </div>
        </div>
      ) : (
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
                    {getStatusBadge(sol.status)}
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
                    Match Score: {Math.round((sol.matchScore ?? 0) * 100)}%
                  </span>
                  <div className="text-[11px] font-mono-data text-[var(--ink-muted)]">
                    Proposed: ₹{((sol.proposedCost ?? 0) / 100000).toFixed(1)}L ({sol.proposedDurationWeeks} wks)
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
                  TRL Claimed: {sol.claimedTRL} · Evaluator Rubric:{" "}
                  {sol.rubricScore ? `${sol.rubricScore.total}/100` : "Under Scoring"}
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
      )}
    </div>
  );
}
