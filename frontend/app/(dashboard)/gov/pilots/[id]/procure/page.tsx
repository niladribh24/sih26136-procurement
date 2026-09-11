"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Award, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Pilot } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { SanctionDocketView } from "@/components/domain/SanctionDocketView";

export default function GovernmentProcurePage() {
  const params = useParams();
  const pilotId = params.id as string;

  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPilot(pilotId).then((data) => {
      setPilot(data);
      setLoading(false);
    });
  }, [pilotId]);

  if (loading) {
    return <div className="p-8 text-center text-xs text-[var(--ink-muted)]">Generating sovereign procurement sanction dossier...</div>;
  }

  if (!pilot) {
    return <div className="p-8 text-center text-xs text-[var(--ink)]">Pilot record not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        href={`/gov/pilots/${pilot.id}`}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)] hover:text-[var(--accent)] font-medium"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Pilot Tracker</span>
      </Link>

      <PageHeader
        code="STAGE-3-PROCURE"
        title="Procurement Sanction Order & GeM Dossier"
        subtitle="Automated sovereign procurement conversion with statutory GFR 149 and DPIIT startup exemption certificates."
        badge={<Badge variant="positive">HERO SCREEN 3: SANCTION DOCKET</Badge>}
      />

      <SanctionDocketView pilot={pilot} />
    </div>
  );
}
