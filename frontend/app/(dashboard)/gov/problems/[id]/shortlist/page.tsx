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
} from "lucide-react";
import { api } from "@/lib/api";
import { Problem, Solution } from "@/lib/types";
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

  // Inspector Drawer State
  const [inspectingSolution, setInspectingSolution] = useState<Solution | null>(null);

  useEffect(() => {
    Promise.all([api.getProblem(problemId), api.getSolutions(problemId)]).then(
      ([probData, solData]) => {
        setProblem(probData);
        // Sort solutions descending by match score
        const sorted = [...solData].sort((a, b) => b.matchScore - a.matchScore);
        setSolutions(sorted);
        setLoading(false);
      }
    );
  }, [problemId]);

  const handleShortlist = (sol: Solution) => {
    setSolutions((prev) =>
      prev.map((s) => (s.id === sol.id ? { ...s, status: "shortlisted" } : s))
    );
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-[var(--ink-muted)]">Computing semantic embeddings & ranking...</div>;
  }

  if (!problem) {
    return <div className="p-8 text-center text-xs text-[var(--ink)]">Problem statement not found.</div>;
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
        badge={<Badge variant="highlight">HERO SCREEN 1: RANKED SHORTLIST</Badge>}
      />

      {/* AI Ranking Telemetry Banner */}
      <div className="p-4 bg-[var(--surface-raised)] border border-[var(--highlight)]/40 rounded-[8px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[6px] bg-[var(--highlight-soft)] flex items-center justify-center text-[var(--highlight)]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-[var(--ink)]">
              NLP Semantic Matching & Cosine Similarity Ranking Active
            </div>
            <div className="text-[11px] text-[var(--ink-muted)]">
              Submissions automatically embedded with sentence-transformers and ranked against technical acceptance criteria.
            </div>
          </div>
        </div>

        <div className="text-xs font-mono-data text-[var(--ink-muted)] shrink-0">
          Evaluated: <strong className="text-[var(--ink)]">{solutions.length} Proposals</strong>
        </div>
      </div>

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
      />
    </div>
  );
}
