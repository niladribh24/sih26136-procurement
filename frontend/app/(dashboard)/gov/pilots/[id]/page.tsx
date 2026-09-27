"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
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
import { getSession, subscribeSession } from "@/lib/auth";
import { errorMessage } from "@/lib/http";
import { Pilot, Milestone } from "@/lib/types";
import { directSanctionEligible, stageBadge } from "@/lib/pilotStateMachine";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MilestoneStepper } from "@/components/domain/MilestoneStepper";
import { MilestoneCard } from "@/components/domain/MilestoneCard";
import { IndependentValidationDrawer } from "@/components/domain/IndependentValidationDrawer";
import { PilotStatusControl } from "@/components/domain/PilotStatusControl";

const getServerSnapshot = () => null;

export default function GovernmentPilotTrackerPage() {
  const params = useParams();
  const router = useRouter();
  const pilotId = params.id as string;

  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingMilestone, setVerifyingMilestone] = useState<Milestone | null>(null);
  const [actionError, setActionError] = useState("");
  const session = useSyncExternalStore(subscribeSession, getSession, getServerSnapshot);

  const loadPilot = () => {
    api
      .getPilot(pilotId)
      .then((data: Pilot | null) => setPilot(data ? { ...data } : null))
      .catch((err: unknown) => setActionError(errorMessage(err, "Could not load this pilot.")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPilot();
  }, [pilotId]);

  const handleRecommendProcurement = async () => {
    if (!pilot) return;
    setActionError("");
    try {
      await api.updatePilotStatus(pilot.id, "Recommended for procurement");
    } catch (err) {
      setActionError(errorMessage(err, "Could not recommend this pilot for procurement."));
      return;
    }
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
  // The backend has the final say (owning officer, conflict of interest); this only hides
  // actions that can't apply to this role or this pilot status.
  const isOfficer = session?.role === "govt_officer";
  const canVerify = pilot.status === "Active" && (isOfficer || session?.role === "evaluator");
  const verifiedCount = pilot.milestones.filter((m) => m.status === "verified").length;
  const sanctionEligible = directSanctionEligible(pilot.status);

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
        badge={<Badge variant="highlight">{stageBadge(pilot.status).label}</Badge>}
        actions={
          (allMilestonesVerified && pilot.status === "Completed" && isOfficer) || isRecommended ? (
            <Button
              variant="primary"
              size="md"
              onClick={isRecommended ? () => router.push(`/gov/pilots/${pilot.id}/procure`) : handleRecommendProcurement}
            >
              <Award className="w-4 h-4 text-[var(--highlight)]" />
              <span>
                {isRecommended
                  ? "View Sanction Docket →"
                  : "Recommend for Direct Sanction (Stage 3) →"}
              </span>
            </Button>
          ) : (
            <div className="text-xs font-mono-data text-[var(--ink-muted)]">
              {pilot.status === "Completed"
                ? "Awaiting the lead officer's sanction recommendation"
                : pilot.status === "Failed"
                ? "Pilot failed: not eligible for procurement"
                : "All milestones must be verified to unlock procurement"}
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

      {isOfficer && <PilotStatusControl pilot={pilot} onUpdated={(p) => setPilot({ ...p })} />}

      {actionError && (
        <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-[6px] text-xs text-[var(--danger)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Trial Performance Telemetry */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-1">
          <span className="text-[11px] font-mono-data text-[var(--ink-muted)] uppercase">
            Trial Performance Rating
          </span>
          {pilot.performanceScore !== undefined ? (
            <div className="text-xl font-bold font-mono-data text-[var(--positive)]">
              {pilot.performanceScore} / 100
            </div>
          ) : (
            <div className="text-sm font-semibold text-[var(--ink-muted)] pt-1">Not scored yet</div>
          )}
          <span className="text-[10px] text-[var(--ink-muted)]">
            Rubric 40% · verification pass rate 40% · on-time delivery 20%
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
                .filter((m) => m.trancheDisbursed)
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
            Direct Sanction Eligibility
          </span>
          {sanctionEligible ? (
            <div className="text-sm font-bold text-[var(--accent)] flex items-center gap-1.5 pt-1">
              <ShieldCheck className="w-4 h-4 text-[var(--positive)]" />
              <span>Eligible for Direct Sanction</span>
            </div>
          ) : pilot.status === "Failed" ? (
            <div className="text-sm font-bold text-[var(--danger)] flex items-center gap-1.5 pt-1">
              <AlertCircle className="w-4 h-4" />
              <span>Not eligible: pilot failed</span>
            </div>
          ) : (
            <div className="text-sm font-bold text-[var(--ink-secondary)] flex items-center gap-1.5 pt-1">
              <AlertCircle className="w-4 h-4 text-[var(--warning)]" />
              <span>Not yet eligible</span>
            </div>
          )}
          <span className="text-[10px] text-[var(--ink-muted)]">
            {sanctionEligible
              ? "Every milestone independently verified"
              : `${verifiedCount} of ${pilot.milestones.length} milestones verified; the trial must complete first`}
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
              canVerify={canVerify}
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
