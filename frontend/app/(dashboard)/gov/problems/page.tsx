"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PlusCircle, FileText, ArrowRight, Users, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { Problem } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function GovernmentProblemsPage() {
  const [problems, setProblems] = useState<Problem[]>([]);

  useEffect(() => {
    api.getProblems().then(setProblems);
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        code="STAGE-1-IDENTIFY"
        title="Department Operational Challenges"
        subtitle="Manage published operational requirements, review incoming startup proposals, and inspect AI-ranked shortlists."
        actions={
          <Link href="/gov/problems/new">
            <Button variant="primary" size="md">
              <PlusCircle className="w-4 h-4" />
              <span>Post New Problem Statement</span>
            </Button>
          </Link>
        }
      />

      <div className="space-y-4">
        {problems.map((prob) => (
          <div
            key={prob.id}
            className="p-6 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-3 shadow-2xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono-data text-[var(--accent)] font-semibold">
                    {prob.code}
                  </span>
                  <Badge variant="info">{prob.domain}</Badge>
                  <span className="text-xs text-[var(--ink-muted)] font-mono-data">
                    Published: {prob.createdAt}
                  </span>
                </div>
                <h2 className="text-base font-bold text-[var(--ink)] font-editorial">
                  {prob.title}
                </h2>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono-data font-bold text-[var(--ink)]">
                  {prob.budgetBand}
                </span>
                <div className="text-[11px] font-mono-data text-[var(--ink-muted)]">
                  Min TRL: {prob.targetTRL}
                </div>
              </div>
            </div>

            <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
              {prob.description}
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--line)] text-xs text-[var(--ink-muted)]">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 font-mono-data">
                  <Users className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Proposals Received: <strong className="text-[var(--ink)]">{prob.submissionCount}</strong>
                </span>
                <span>Deadline: {prob.deadline}</span>
              </div>

              <Link href={`/gov/problems/${prob.id}/shortlist`}>
                <Button variant="primary" size="sm">
                  <span>View Ranked Shortlist ({prob.submissionCount})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
