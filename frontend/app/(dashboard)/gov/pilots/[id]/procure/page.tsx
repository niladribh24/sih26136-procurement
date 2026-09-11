"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Award, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Pilot } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SanctionDocketView } from "@/components/domain/SanctionDocketView";

export default function GovernmentProcurePage() {
  const params = useParams();
  const pilotId = params.id as string;

  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPilot(pilotId).then((data: Pilot | null) => {
      setPilot(data);
      setLoading(false);
    });
  }, [pilotId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-mono-data text-[var(--ink-muted)]">
        Preparing official procurement sanction memorandum...
      </div>
    );
  }

  if (!pilot) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-12 text-center">
        <div className="p-8 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-3">
          <div className="text-sm font-bold text-[var(--ink)]">Pilot Record Not Found</div>
          <p className="text-xs text-[var(--ink-muted)]">
            The requested trial record does not exist or has been archived.
          </p>
          <div className="pt-2">
            <Link href="/gov/pilots">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Return to Department Pilots
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const allMilestonesVerified = pilot.milestones.every((m) => m.status === "verified");
  const isRecommended = pilot.status === "Recommended for procurement" || pilot.status === "Procured";

  if (!allMilestonesVerified && !isRecommended) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto py-12 text-center">
        <div className="p-8 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-4">
          <div className="w-12 h-12 rounded-full bg-[var(--danger-soft)] text-[var(--danger)] flex items-center justify-center mx-auto">
            <Award className="w-6 h-6" />
          </div>
          <div className="text-base font-bold text-[var(--ink)]">
            Procurement Sanction Docket Locked
          </div>
          <p className="text-xs text-[var(--ink-secondary)] max-w-lg mx-auto leading-relaxed">
            Statutory compliance under GFR Rule 149 / 194 requires that all time-boxed trial milestones be verified by the independent technical evaluator before an innovation procurement sanction order can be generated.
          </p>
          <div className="pt-2">
            <Link href={`/gov/pilots/${pilot.id}`}>
              <Button variant="primary" size="sm">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Return to Pilot Milestone Tracker
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="print:hidden">
        <Link
          href={`/gov/pilots/${pilot.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)] hover:text-[var(--accent)] font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Pilot Tracker</span>
        </Link>
      </div>

      <div className="print:hidden">
        <PageHeader
          code="STAGE-3-PROCURE"
          title="Procurement Sanction Order & GeM Dossier"
          subtitle="Direct public procurement authorization under statutory GFR 149 & 194 innovation exemptions."
          badge={<Badge variant="positive">Stage 3: Direct Sanction</Badge>}
        />
      </div>

      <SanctionDocketView pilot={pilot} />
    </div>
  );
}
