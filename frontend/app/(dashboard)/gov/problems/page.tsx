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
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    api.getProblems()
      .then(setProblems)
      .catch((err: unknown) => console.error("Failed to load problems", err))
      .finally(() => setLoading(false));
  }, []);

  const domains = ["all", "DroneTech", "AgriTech", "Defence", "HealthTech", "CleanTech", "GovTech"];

  const filtered = problems.filter((prob) => {
    const matchDomain = selectedDomain === "all" || prob.domain === selectedDomain;
    const query = searchQuery.trim().toLowerCase();
    const matchQuery =
      !query ||
      (prob.title?.toLowerCase().includes(query) ?? false) ||
      (prob.description?.toLowerCase().includes(query) ?? false) ||
      (prob.code?.toLowerCase().includes(query) ?? false);
    return matchDomain && matchQuery;
  });

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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px]">
        <div className="flex flex-wrap items-center gap-1.5">
          {domains.map((dom) => (
            <button
              key={dom}
              type="button"
              onClick={() => setSelectedDomain(dom)}
              className={`px-2.5 py-1 text-xs rounded-[4px] capitalize transition-colors cursor-pointer ${
                selectedDomain === dom
                  ? "bg-[var(--accent)] text-white font-semibold"
                  : "bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--surface-subtle)] border border-[var(--line)]"
              }`}
            >
              {dom}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search challenges, codes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--line)] rounded-[4px] text-[var(--ink)] placeholder-[var(--ink-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-[var(--ink-muted)] flex items-center justify-center gap-2">
          <Clock className="w-4 h-4 animate-spin" />
          <span>Loading published operational challenges...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-3">
          <FileText className="w-10 h-10 text-[var(--ink-muted)] mx-auto" />
          <h3 className="text-base font-bold text-[var(--ink)] font-editorial">
            No Problem Statements Found
          </h3>
          <p className="text-xs text-[var(--ink-muted)] max-w-md mx-auto">
            {searchQuery || selectedDomain !== "all"
              ? "No challenges match the active filter criteria. Try changing or clearing your search."
              : "No department problem statements are currently published. Create your first operational RFP to solicit startup proposals."}
          </p>
          <div className="pt-2">
            <Link href="/gov/problems/new">
              <Button variant="primary" size="sm">
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                Publish First Problem Statement
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((prob) => (
            <div
              key={prob.id}
              className="p-6 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-3 shadow-2xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono-data text-[var(--accent)] font-semibold">
                      {prob.code}
                    </span>
                    <Badge variant="info">{prob.domain}</Badge>
                    <Badge variant={prob.status === "open" ? "positive" : prob.status === "pilot_active" ? "highlight" : "warning"}>
                      {prob.status.replace("_", " ").toUpperCase()}
                    </Badge>
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
      )}
    </div>
  );
}
