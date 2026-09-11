"use client";

import React from "react";
import { ShieldCheck, ArrowRight, CheckCircle2, Sparkles, Building2 } from "lucide-react";
import { Solution } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface RankedSolutionCardProps {
  solution: Solution;
  rank: number;
  onInspect: (solution: Solution) => void;
  onShortlist: (solution: Solution) => void;
  isShortlisted?: boolean;
}

export const RankedSolutionCard: React.FC<RankedSolutionCardProps> = ({
  solution,
  rank,
  onInspect,
  onShortlist,
  isShortlisted = false,
}) => {
  const matchPct = Math.round(solution.matchScore * 100);

  return (
    <div className="p-6 bg-[var(--surface-raised)] border border-[var(--line)] hover:border-[var(--line-strong)] rounded-[8px] space-y-4 shadow-2xs transition-all">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        {/* Left: Rank & Identification */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-[6px] bg-[var(--surface-subtle)] border border-[var(--line)] flex items-center justify-center font-mono-data font-bold text-sm text-[var(--accent)] shrink-0">
            #{rank}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-[var(--ink)] font-editorial">
                {solution.startupName}
              </h3>
              {solution.dpiitVerified ? (
                <Badge variant="dpiit_verified">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  DPIIT: {solution.dpiitNumber}
                </Badge>
              ) : (
                <Badge variant="warning">DPIIT: PENDING</Badge>
              )}
              <span className="text-xs font-mono-data text-[var(--ink-muted)]">
                {solution.location}
              </span>
            </div>
            <p className="text-xs font-medium text-[var(--ink-secondary)]">
              {solution.title}
            </p>
          </div>
        </div>

        {/* Right: AI Match Score & Economics */}
        <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-1 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--highlight-soft)] border border-[var(--highlight)]/30 text-xs font-bold font-mono-data text-[var(--highlight)] shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{matchPct}% Match</span>
          </div>
          <div className="text-right text-xs font-mono-data mt-1">
            <span className="font-bold text-[var(--ink)]">
              ₹{(solution.proposedCost / 100000).toFixed(1)}L
            </span>
            <span className="text-[var(--ink-muted)]"> · {solution.claimedTRL}</span>
          </div>
        </div>
      </div>

      {/* NLP Abstract */}
      <div className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-[6px] text-xs text-[var(--ink-secondary)] leading-relaxed">
        <span className="font-semibold text-[var(--ink)] font-mono-data uppercase text-[11px] block mb-1">
          NLP Synthesized Abstract:
        </span>
        {solution.abstract}
      </div>

      {/* Keyword Overlap Signals */}
      {solution.matchedKeywords && solution.matchedKeywords.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--ink-muted)]">
            Semantic Overlap Criteria:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {solution.matchedKeywords.map((kw) => (
              <span
                key={kw}
                className="px-2 py-0.5 rounded-[4px] bg-[var(--highlight-soft)] border border-[var(--highlight)]/20 text-[var(--highlight)] text-[11px] font-mono-data"
              >
                [ {kw} ]
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--line)] text-xs">
        <span className="text-[11px] font-mono-data text-[var(--ink-muted)]">
          Proposed Timeline: {solution.proposedDurationWeeks} Weeks · Rubric Score:{" "}
          <strong className="text-[var(--ink)]">
            {solution.rubricScore ? `${solution.rubricScore.total}/100` : "88/100"}
          </strong>
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onInspect(solution)}
          >
            <span>Inspect Evidence & Rubric</span>
          </Button>

          <Button
            variant={isShortlisted ? "secondary" : "primary"}
            size="sm"
            onClick={() => onShortlist(solution)}
          >
            {isShortlisted ? (
              <span className="flex items-center gap-1 text-[var(--positive)]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Shortlisted
              </span>
            ) : (
              <span>Shortlist for Pilot</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
