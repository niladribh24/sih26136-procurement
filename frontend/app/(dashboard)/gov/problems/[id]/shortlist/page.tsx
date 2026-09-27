"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Sliders,
  CheckCircle2,
  Calendar,
  IndianRupee,
  Layers,
  Award,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { ApiError, errorMessage } from "@/lib/http";
import { Problem, Solution, isMatchPending } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RankedSolutionCard } from "@/components/domain/RankedSolutionCard";
import { SolutionInspectorDrawer } from "@/components/domain/SolutionInspectorDrawer";

export default function GovernmentRankedShortlistPage() {
  const params = useParams();
  const problemId = params.id as string;

  const [problem, setProblem] = useState<Problem | null>(null);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [ranking, setRanking] = useState(false);

  // Inspector Drawer State
  const [inspectingSolution, setInspectingSolution] = useState<Solution | null>(null);

  // Sort descending by match score (the backend already does; unscored = 0 sinks to the end)
  const byScore = (list: Solution[]) => [...list].sort((a, b) => b.matchScore - a.matchScore);

  useEffect(() => {
    // Listing a problem's solutions also triggers AI ranking server-side for any unranked ones.
    Promise.all([api.getProblem(problemId), api.getSolutions(problemId)])
      .then(([probData, solData]) => {
        setProblem(probData);
        setSolutions(byScore(solData));
      })
      .catch((err: unknown) => setActionError(errorMessage(err, "Could not load proposals.")))
      .finally(() => setLoading(false));
  }, [problemId]);

  const handleShortlist = async (sol: Solution) => {
    const newStatus = sol.status === "shortlisted" ? "under_review" : "shortlisted";
    setActionError("");
    setSolutions((prev) =>
      prev.map((s) => (s.id === sol.id ? { ...s, status: newStatus } : s))
    );
    try {
      await api.updateSolutionStatus(sol.id, newStatus);
    } catch (err) {
      // Roll back the optimistic update
      setSolutions((prev) => prev.map((s) => (s.id === sol.id ? { ...s, status: sol.status } : s)));
      setActionError(
        err instanceof ApiError && err.status === 403
          ? "Only the officer who posted this problem, or an evaluator, can change proposal status."
          : errorMessage(err, "Failed to update proposal status.")
      );
    }
  };

  const handleRerank = async () => {
    if (ranking) return;
    setActionError("");
    setRanking(true);
    try {
      setSolutions(byScore(await api.rankSolutions(problemId)));
    } catch (err) {
      const status = err instanceof ApiError ? err.status : -1;
      setActionError(
        status === 503
          ? "The AI matching service is offline. Scores will be computed once it is back."
          : status === 403
            ? "Only the officer who posted this problem, or an evaluator, can re-run AI ranking."
            : errorMessage(err, "AI ranking failed. Please retry.")
      );
    } finally {
      setRanking(false);
    }
  };

  const pendingCount = solutions.filter(isMatchPending).length;

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-mono-data text-[var(--ink-muted)]">
        Loading proposals & evaluation rankings...
      </div>
    );
  }

  if (!problem && actionError) {
    return (
      <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-[6px] text-xs text-[var(--danger)] flex items-center gap-2 max-w-5xl">
        <AlertCircle className="w-4 h-4" />
        <span>{actionError}</span>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-12 text-center">
        <div className="p-8 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-3">
          <div className="text-sm font-bold text-[var(--ink)]">Problem Statement Not Found</div>
          <p className="text-xs text-[var(--ink-muted)]">
            The requested challenge statement ID does not exist or has been archived.
          </p>
          <div className="pt-2">
            <Link href="/gov/problems">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Return to Problems
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/gov/problems"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)] hover:text-[var(--accent)] font-medium"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to My Problems</span>
      </Link>

      <PageHeader
        code={problem.code}
        title={problem.title}
        subtitle={`${problem.department} · Budget: ${problem.budgetBand} · Target: ${problem.targetTRL}`}
        badge={<Badge variant="highlight">Stage 1: Proposal Ranking</Badge>}
      />

      {/* Proposal Ranking Telemetry Banner */}
      <div className="p-4 bg-[var(--surface-raised)] border border-[var(--highlight)]/40 rounded-[8px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[6px] bg-[var(--highlight-soft)] flex items-center justify-center text-[var(--highlight)]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-[var(--ink)]">
              AI Match Ranking
            </div>
            <div className="text-[11px] text-[var(--ink-muted)]">
              Proposals ranked by semantic similarity to this problem statement (ML service). Eligibility and rubric scores are shown per proposal.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-xs font-mono-data text-[var(--ink-muted)] text-right">
            <div>
              Evaluated: <strong className="text-[var(--ink)]">{solutions.length} Proposals</strong>
            </div>
            {pendingCount > 0 && (
              <div className="text-[11px] text-[var(--warning)]">{pendingCount} awaiting AI match</div>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRerank}
            disabled={ranking || solutions.length === 0}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${ranking ? "animate-spin" : ""}`} />
            {ranking ? "Ranking..." : "Re-run AI Ranking"}
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-[6px] text-xs text-[var(--danger)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Candidate Solutions List */}
      <div className="space-y-4">
        {solutions.map((sol, index) => (
          <RankedSolutionCard
            key={sol.id}
            solution={sol}
            rank={index + 1}
            onInspect={(selected) => setInspectingSolution(selected)}
            onShortlist={handleShortlist}
            isShortlisted={sol.status === "shortlisted"}
          />
        ))}

        {solutions.length === 0 && (
          <div className="p-12 text-center bg-[var(--surface)] border border-[var(--line)] rounded-[8px] text-xs text-[var(--ink-muted)]">
            No startup proposals submitted yet for this challenge.
          </div>
        )}
      </div>

      {/* Contextual Solution Inspector Drawer */}
      <SolutionInspectorDrawer
        isOpen={inspectingSolution !== null}
        onClose={() => setInspectingSolution(null)}
        solution={inspectingSolution}
        problem={problem}
        onSolutionUpdated={(updated) => {
          setSolutions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          setInspectingSolution(updated);
        }}
      />
    </div>
  );
}
