"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Rocket,
  Award,
  Calendar,
  IndianRupee,
  FileCheck,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { Pilot, Milestone } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MilestoneStepper } from "@/components/domain/MilestoneStepper";
import { MilestoneCard } from "@/components/domain/MilestoneCard";
import { IndependentValidationDrawer } from "@/components/domain/IndependentValidationDrawer";

export default function GovernmentPilotTrackerPage() {
  const params = useParams();
  const router = useRouter();
  const pilotId = params.id as string;

  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingMilestone, setVerifyingMilestone] = useState<Milestone | null>(null);

  const loadPilot = () => {
    api.getPilot(pilotId).then((data: Pilot | null) => {
      setPilot(data ? { ...data } : null);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadPilot();
  }, [pilotId]);

  const handleRecommendProcurement = async () => {
    if (!pilot) return;
    await api.updatePilotStatus(pilot.id, "Recommended for procurement");
    router.push(`/gov/pilots/${pilot.id}/procure`);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-mono-data text-[var(--ink-muted)]">
        Loading trial state machine...
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

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/gov/pilots"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)] hover:text-[var(--accent)] font-medium"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Department Pilots</span>
      </Link>

      <PageHeader
        code={pilot.code}
        title={`${pilot.startupName} — Field Pilot Tracker`}
        subtitle={`${pilot.department} · Sanction: ₹${(pilot.totalBudget / 100000).toFixed(1)}L · Duration: ${pilot.durationWeeks} Weeks`}
        badge={<Badge variant="highlight">HERO SCREEN 2: PILOT TRACKER</Badge>}
        actions={
          allMilestonesVerified || isRecommended ? (
            <Button
              variant="primary"
              size="md"
              onClick={isRecommended ? () => router.push(`/gov/pilots/${pilot.id}/procure`) : handleRecommendProcurement}
            >
              <Award className="w-4 h-4 text-[var(--highlight)]" />
              <span>
                {isRecommended
                  ? "View Generated Procurement Docket →"
                  : "Recommend for Direct Sanction (Stage 3) →"}
              </span>
            </Button>
          ) : (
            <div className="text-xs font-mono-data text-[var(--ink-muted)]">
              All milestones must be verified to unlock procurement
            </div>
          )
        }
      />

      {/* Hero Stepper */}
      <MilestoneStepper
        currentStatus={pilot.status}
        leadOfficer={pilot.leadOfficerName}
        independentValidator={pilot.independentValidatorName}
      />

      {/* Trial Performance Telemetry */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-1">
          <span className="text-[11px] font-mono-data text-[var(--ink-muted)] uppercase">
            Trial Performance Rating
          </span>
          <div className="text-xl font-bold font-mono-data text-[var(--positive)]">
            {pilot.performanceScore || 94.2} / 100
          </div>
          <span className="text-[10px] text-[var(--ink-muted)]">
            Independent benchmark index
          </span>
        </div>

        <div className="p-4 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-1">
          <span className="text-[11px] font-mono-data text-[var(--ink-muted)] uppercase">
            Disbursed Tranches
          </span>
          <div className="text-xl font-bold font-mono-data text-[var(--ink)]">
            ₹
            {(
              pilot.milestones
                .filter((m) => m.status === "verified")
                .reduce((acc, curr) => acc + curr.trancheAmount, 0) / 100000
            ).toFixed(2)}{" "}
            Lakhs
          </div>
          <span className="text-[10px] text-[var(--ink-muted)]">
            of ₹{(pilot.totalBudget / 100000).toFixed(2)} Lakhs total
          </span>
        </div>

        <div className="p-4 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-1">
          <span className="text-[11px] font-mono-data text-[var(--ink-muted)] uppercase">
            GFR Rule 149 Eligibility
          </span>
          <div className="text-sm font-bold text-[var(--accent)] flex items-center gap-1.5 pt-1">
            <ShieldCheck className="w-4 h-4 text-[var(--positive)]" />
            <span>Eligible for Direct Sanction</span>
          </div>
          <span className="text-[10px] text-[var(--ink-muted)]">
            Validated innovation procurement
          </span>
        </div>
      </div>

      {/* Milestones Register */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--ink)] font-editorial">
            Trial Milestones & Deliverables
          </h3>
          <span className="text-xs font-mono-data text-[var(--ink-muted)]">
            {pilot.milestones.filter((m) => m.status === "verified").length} of{" "}
            {pilot.milestones.length} Verified
          </span>
        </div>

        <div className="space-y-4">
          {pilot.milestones.map((milestone) => (
            <MilestoneCard
              key={milestone.id}
              milestone={milestone}
              onVerify={(m) => setVerifyingMilestone(m)}
              canVerify={true}
            />
          ))}
        </div>
      </div>

      {/* Independent Verification Drawer */}
      <IndependentValidationDrawer
        isOpen={verifyingMilestone !== null}
        onClose={() => setVerifyingMilestone(null)}
        milestone={verifyingMilestone}
        pilot={pilot}
        onVerified={() => loadPilot()}
      />
    </div>
  );
}
