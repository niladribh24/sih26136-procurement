"use client";

import React, { useState, useEffect } from "react";
import { Share2, CheckCircle2, ShieldCheck, Award, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";

export default function StartupScaleShowcasePage() {
  const [scaleItems, setScaleItems] = useState<any[]>([]);

  useEffect(() => {
    api.getScaleSolutions().then(setScaleItems);
  }, []);

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
          <strong>The Scale Advantage:</strong> Once your startup successfully passes all pilot milestones in one ministry, other departments can adopt your solution under GFR Rule 149 without forcing you through redundant trial runs.
        </p>
      </div>

      <div className="space-y-4">
        {scaleItems.map((item) => (
          <div
            key={item.id}
            className="p-6 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-4 shadow-2xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono-data text-[var(--accent)] font-semibold">
                    {item.pilotCode}
                  </span>
                  <Badge variant="positive">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    SCALE CERTIFIED
                  </Badge>
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
        ))}
      </div>
    </div>
  );
}
