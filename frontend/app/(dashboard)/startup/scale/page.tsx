"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Award, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { ScaleSolution } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";

export default function StartupScaleShowcasePage() {
  const [scaleItems, setScaleItems] = useState<ScaleSolution[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("All");

  const domains = ["All", "Agriculture", "Defense", "Forestry", "Healthcare", "GovTech"];

  useEffect(() => {
    api.getScaleSolutions().then(setScaleItems);
  }, []);

  const session = getSession();

  const filteredItems = scaleItems.filter((item) => {
    const matchesSearch =
      searchTerm === "" ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.startupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.domain && item.domain.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesDomain =
      selectedDomain === "All" ||
      (item.domain && item.domain.toLowerCase() === selectedDomain.toLowerCase());

    return matchesSearch && matchesDomain;
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        code="STAGE-4-SCALE"
        title="Proven Sovereign Innovations Showcase"
        subtitle="Explore startup solutions that have completed pilots, achieved sovereign validation, and scaled across ministries."
      />

      <div className="p-4 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] flex items-center gap-3">
        <Award className="w-5 h-5 text-[var(--accent)] shrink-0" />
        <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
          <strong>The Scale Advantage:</strong> Once your startup successfully passes all pilot milestones in one ministry, other departments can adopt your solution under GFR Rule 149 & Rule 194 without forcing you through redundant trial runs.
        </p>
      </div>

      {/* Search and Sector Filter */}
      <div className="p-4 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-3">
        <input
          type="text"
          placeholder="Search by innovation title, domain, or technology..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 text-xs bg-[var(--surface)] border border-[var(--line)] rounded-[6px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)] font-sans"
        />

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-mono-data uppercase text-[var(--ink-muted)] mr-1">
            Sector Filter:
          </span>
          {domains.map((dom) => (
            <button
              key={dom}
              type="button"
              onClick={() => setSelectedDomain(dom)}
              className={`px-2.5 py-1 rounded-[4px] text-xs font-mono-data cursor-pointer transition-colors ${
                selectedDomain === dom
                  ? "bg-[var(--accent)] text-white font-semibold"
                  : "bg-[var(--surface)] text-[var(--ink-secondary)] border border-[var(--line)] hover:border-[var(--line-strong)]"
              }`}
            >
              {dom}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredItems.map((item) => {
          const isOwnVenture =
            session?.dpiitNumber &&
            (item.dpiitNumber === session.dpiitNumber ||
              item.startupName.toLowerCase().includes((session?.orgName || "").toLowerCase()));

          return (
            <div
              key={item.id}
              className={`p-6 bg-[var(--surface-raised)] border rounded-[8px] space-y-4 shadow-2xs transition-all ${
                isOwnVenture
                  ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/30"
                  : "border-[var(--line)]"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono-data text-[var(--accent)] font-semibold">
                      {item.pilotCode}
                    </span>
                    <Badge variant="positive">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      SCALE CERTIFIED
                    </Badge>
                    {isOwnVenture && (
                      <span className="px-2 py-0.5 rounded bg-[var(--accent)] text-white text-[10px] font-mono-data font-bold uppercase">
                        ★ Your Venture
                      </span>
                    )}
                    {item.domain && (
                      <span className="px-2 py-0.5 rounded bg-[var(--surface-subtle)] border border-[var(--line)] text-[10px] font-mono-data text-[var(--ink-muted)]">
                        {item.domain}
                      </span>
                    )}
                    <span className="text-xs font-mono-data text-[var(--ink-muted)]">
                      {item.startupName} ({item.dpiitNumber})
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-[var(--ink)] font-editorial">
                    {item.title}
                  </h2>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono-data font-bold text-[var(--positive)]">
                    Performance Score: {item.performanceScore}/100
                  </span>
                  <div className="text-[11px] font-mono-data text-[var(--ink-muted)]">
                    Units Deployed: {item.deployedUnits} ({item.budgetPerUnit}/unit)
                  </div>
                </div>
              </div>

              <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
                {item.summary}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--line)] text-xs text-[var(--ink-muted)]">
                <span className="flex items-center gap-1 font-mono-data text-[11px]">
                  <Building2 className="w-3.5 h-3.5" />
                  Originating Dept: {item.originatingDepartment}
                </span>
                <span className="font-mono-data text-[11px] text-[var(--accent)]">
                  Exemption: {item.gfrExemptionClause}
                </span>
              </div>
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="p-12 text-center bg-[var(--surface)] border border-[var(--line)] rounded-[8px] text-xs text-[var(--ink-muted)]">
            No sovereign-validated scale solutions match your search or filter parameters.
          </div>
        )}
      </div>
    </div>
  );
}
