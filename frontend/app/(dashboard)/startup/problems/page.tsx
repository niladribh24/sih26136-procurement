"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Compass, Filter, Calendar, IndianRupee, Layers, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Problem } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function StartupProblemBrowserPage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api.getProblems().then(setProblems);
  }, []);

  const domains = ["all", "DroneTech", "AgriTech", "Defence", "HealthTech", "CleanTech", "GovTech"];

  const filtered = problems.filter((p) => {
    const matchDomain = selectedDomain === "all" || p.domain === selectedDomain;
    const query = searchQuery.trim().toLowerCase();
    const matchQuery =
      !query ||
      (p.title?.toLowerCase().includes(query) ?? false) ||
      (p.description?.toLowerCase().includes(query) ?? false) ||
      (p.code?.toLowerCase().includes(query) ?? false);
    return matchDomain && matchQuery;
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        code="STAGE-1-IDENTIFY"
        title="Government Operational Challenges"
        subtitle="Explore open problem statements published by sovereign ministries, departments, and defence cells."
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-[var(--ink-muted)] flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Domain:
          </span>
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
            placeholder="Search keywords, IDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--line)] rounded-[4px] text-[var(--ink)] placeholder-[var(--ink-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* Problems List */}
      <div className="space-y-4">
        {filtered.map((problem) => (
          <div
            key={problem.id}
            className="p-6 bg-[var(--surface-raised)] border border-[var(--line)] hover:border-[var(--line-strong)] rounded-[8px] transition-all space-y-4 shadow-2xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-xs font-mono-data px-2 py-0.5 rounded bg-[var(--surface-subtle)] text-[var(--ink-secondary)] border border-[var(--line)]">
                    {problem.code}
                  </span>
                  <Badge variant="info">{problem.domain}</Badge>
                  <Badge variant={problem.status === "open" ? "positive" : problem.status === "pilot_active" ? "highlight" : "warning"}>
                    {problem.status.replace("_", " ").toUpperCase()}
                  </Badge>
                  <span className="text-xs font-mono-data text-[var(--ink-muted)]">
                    {problem.department}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-[var(--ink)] font-editorial">
                  {problem.title}
                </h2>
              </div>

              <div className="shrink-0 flex sm:flex-col items-end gap-1 text-right">
                <span className="text-xs font-mono-data font-semibold text-[var(--accent)]">
                  {problem.budgetBand}
                </span>
                <span className="text-[11px] font-mono-data text-[var(--ink-muted)]">
                  Target: {problem.targetTRL}
                </span>
              </div>
            </div>

            <p className="text-xs text-[var(--ink-secondary)] leading-relaxed line-clamp-2">
              {problem.description}
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--line)] text-xs text-[var(--ink-muted)]">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Deadline: {problem.deadline}
                </span>
                <span className="font-mono-data">
                  Proposals Submitted: {problem.submissionCount}
                </span>
              </div>

              <Link href={`/startup/problems/${problem.id}`}>
                <Button variant="primary" size="sm">
                  <span>View Specifications & Apply</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-12 text-center bg-[var(--surface)] border border-[var(--line)] rounded-[8px] text-xs text-[var(--ink-muted)]">
            No open challenges found matching the selected criteria.
          </div>
        )}
      </div>
    </div>
  );
}
