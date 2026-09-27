"use client";

import React, { useState } from "react";
import { CheckCircle2, AlertCircle, Send, Printer } from "lucide-react";
import { Pilot } from "@/lib/types";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/http";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AuditStamp } from "@/components/data/AuditStamp";

export interface SanctionDocketViewProps {
  pilot: Pilot;
  /** True for the lead officer: shows the "Record procurement" action once recommended. */
  canRecord?: boolean;
  onUpdated?: (pilot: Pilot) => void;
}

export const SanctionDocketView: React.FC<SanctionDocketViewProps> = ({ pilot, canRecord = false, onUpdated }) => {
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState("");

  const isProcured = pilot.status === "Procured";
  // Real reference only once procured (backend: procurement_records); until then this is a draft.
  const sanctionOrderRef = pilot.sanctionOrderRef ?? "Draft (not yet sanctioned)";
  const verifiedMilestonesCount = pilot.milestones.filter((m) => m.status === "verified").length;
  const totalMilestonesCount = pilot.milestones.length;
  const isAllVerified = totalMilestonesCount > 0 && verifiedMilestonesCount === totalMilestonesCount;
  const totalBudgetFormatted = `₹${pilot.totalBudget.toLocaleString("en-IN")}`;
  const budgetInLakhs = (pilot.totalBudget / 100000).toFixed(2);

  const handleRecordProcurement = async () => {
    setRecording(true);
    setRecordError("");
    try {
      const updated = await api.updatePilotStatus(pilot.id, "Procured");
      if (updated) onUpdated?.(updated);
    } catch (err) {
      setRecordError(errorMessage(err, "Could not record the procurement."));
    } finally {
      setRecording(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Sovereign Sanction Order Dossier */}
      <div className="p-8 bg-white border border-[var(--line-strong)] rounded-[4px] shadow-sm space-y-8 print:border-none print:shadow-none print:p-0 font-editorial">
        {/* Header Letterhead */}
        <div className="text-center border-b-2 border-[var(--ink)] pb-6 space-y-2">
          {/* Official Verification Seal */}
          <img
            src="/samarth-seal-verified.svg"
            alt="Government of India Public Procurement Verification Seal"
            className="w-20 h-20 mx-auto mb-2"
          />
          <div className="text-xs font-mono-data tracking-widest uppercase text-[var(--ink-muted)]">
            Government of India · Public Procurement Authority
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] uppercase">
            Official Innovation Sanction Memorandum
          </h1>
          <div className="text-xs font-mono-data text-[var(--ink-secondary)]">
            Under General Financial Rules (GFR 2017) Rule 149 & Rule 194 · Startup Innovation Direct Procurement
          </div>
          <div className="flex justify-between items-center pt-3 text-xs font-mono-data text-[var(--ink-muted)] border-t border-[var(--line)]">
            <span>Sanction Order Ref: <strong>{sanctionOrderRef}</strong></span>
            <span>Printed: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
        </div>

        {/* Section 1: Vendor Identification */}
        <div className="space-y-2 text-xs font-sans">
          <h2 className="text-xs font-mono-data uppercase tracking-wider text-[var(--ink-muted)] font-bold border-b border-[var(--line)] pb-1">
            1. Vendor Particulars & DPIIT Verification
          </h2>
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <span className="text-[var(--ink-muted)] block text-[11px]">Qualified Vendor Entity:</span>
              <strong className="text-sm text-[var(--ink)]">{pilot.startupName}</strong>
            </div>
            <div>
              <span className="text-[var(--ink-muted)] block text-[11px]">DPIIT Recognition Number:</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono-data font-bold text-[var(--positive)]">
                  {pilot.dpiitNumber}
                </span>
                {pilot.dpiitVerified ? (
                  <Badge variant="dpiit_verified">DPIIT VERIFIED</Badge>
                ) : (
                  <Badge variant="dpiit_pending">DPIIT VERIFICATION PENDING</Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Pilot Trial Performance Audit */}
        <div className="space-y-3 text-xs font-sans">
          <h2 className="text-xs font-mono-data uppercase tracking-wider text-[var(--ink-muted)] font-bold border-b border-[var(--line)] pb-1">
            2. Field Pilot Trial Performance Audit & Tranche Schedule
          </h2>
          <div className="grid grid-cols-3 gap-3 p-4 bg-[var(--surface)] border border-[var(--line)] rounded-[4px]">
            <div>
              <span className="text-[11px] font-mono-data text-[var(--ink-muted)] uppercase block">
                Trial Protocol
              </span>
              <strong className="text-[var(--ink)] font-mono-data">{pilot.code}</strong>
              <div className="text-[10px] text-[var(--ink-muted)] mt-0.5">
                Duration: {pilot.durationWeeks} Weeks
              </div>
            </div>
            <div>
              <span className="text-[11px] font-mono-data text-[var(--ink-muted)] uppercase block">
                Milestones Verified
              </span>
              <strong className="text-[var(--positive)] font-mono-data">
                {verifiedMilestonesCount} of {totalMilestonesCount} Passed
              </strong>
              <div className="text-[10px] text-[var(--ink-muted)] mt-0.5">
                {isAllVerified ? "100% KPI Completion" : "Trial in progress"}
              </div>
            </div>
            <div>
              <span className="text-[11px] font-mono-data text-[var(--ink-muted)] uppercase block">
                Performance Rating
              </span>
              <strong className="text-[var(--accent)] font-mono-data text-sm">
                {pilot.performanceScore !== undefined ? `${pilot.performanceScore} / 100` : "Not scored yet"}
              </strong>
              <div className="text-[10px] text-[var(--ink-muted)] mt-0.5">
                Rubric, verification pass rate, on-time delivery
              </div>
            </div>
          </div>

          {/* Tabular Tranche Schedule */}
          <div className="overflow-x-auto border border-[var(--line)] rounded-[4px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--surface-subtle)] border-b border-[var(--line)] font-mono-data text-[10px] text-[var(--ink-muted)] uppercase">
                <tr>
                  <th className="py-2 px-3">M#</th>
                  <th className="py-2 px-3">Milestone Deliverable</th>
                  <th className="py-2 px-3">Target KPI</th>
                  <th className="py-2 px-3 text-right">Tranche</th>
                  <th className="py-2 px-3 text-right">Amount (₹)</th>
                  <th className="py-2 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] font-sans">
                {pilot.milestones.map((m) => (
                  <tr key={m.id} className="text-[11px]">
                    <td className="py-2 px-3 font-mono-data font-bold text-[var(--accent)]">
                      M{m.sequence}
                    </td>
                    <td className="py-2 px-3 font-medium text-[var(--ink)]">
                      {m.title}
                    </td>
                    <td className="py-2 px-3 font-mono-data text-[var(--ink-secondary)]">
                      {m.targetKPI}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-data text-[var(--ink)]">
                      {m.tranchePercentage}%
                    </td>
                    <td className="py-2 px-3 text-right font-mono-data font-bold text-[var(--ink)]">
                      ₹{(m.trancheAmount).toLocaleString("en-IN")}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono-data font-semibold ${
                        m.status === "verified"
                          ? "bg-[var(--positive-soft)] text-[var(--positive)]"
                          : "bg-[var(--surface)] text-[var(--ink-muted)]"
                      }`}>
                        {m.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Statutory Exemptions */}
        <div className="space-y-2 text-xs font-sans">
          <h2 className="text-xs font-mono-data uppercase tracking-wider text-[var(--ink-muted)] font-bold border-b border-[var(--line)] pb-1">
            3. Statutory Exemptions & Public Compliance Seals
          </h2>
          <div className="space-y-2 pt-1">
            <div className="flex items-start gap-2 p-2.5 rounded bg-[var(--surface)] border border-[var(--line)]">
              <CheckCircle2 className="w-4 h-4 text-[var(--positive)] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[var(--ink)]">
                  GFR 2017 Rule 149 & Rule 194 Special Exemption for Field-Validated Innovations:
                </strong>
                <p className="text-[11px] text-[var(--ink-secondary)] mt-0.5 leading-relaxed">
                  The subject innovation completed a government pilot trial whose milestones were each verified by an independent validator, the basis for direct procurement without a prior tender notification.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded bg-[var(--surface)] border border-[var(--line)]">
              <CheckCircle2 className="w-4 h-4 text-[var(--positive)] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[var(--ink)]">
                  DPIIT Circular No. 12(11)/2016 Exemption (Prior Turnover & Prior Experience):
                </strong>
                <p className="text-[11px] text-[var(--ink-secondary)] mt-0.5 leading-relaxed">
                  Exempted from mandatory 3-year turnover and tender qualification criteria in accordance with Ministry of Commerce guidelines for registered DPIIT startups.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Sanctioned Procurement Scope */}
        <div className="space-y-2 text-xs font-sans">
          <h2 className="text-xs font-mono-data uppercase tracking-wider text-[var(--ink-muted)] font-bold border-b border-[var(--line)] pb-1">
            4. Recommended Sanction & Deployment Scope
          </h2>
          <div className="p-4 bg-[var(--surface-subtle)] border border-[var(--line)] rounded-[4px] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono-data text-[var(--ink-muted)] uppercase block">
                Total Authorized Innovation Sanction Value:
              </span>
              <div className="text-2xl font-bold font-mono-data text-[var(--accent)] mt-0.5">
                {totalBudgetFormatted}
              </div>
              <span className="text-[11px] text-[var(--ink-secondary)] font-mono-data">
                (Rupees {budgetInLakhs} Lakhs Only)
              </span>
            </div>
            <div className="text-right text-xs font-mono-data space-y-1">
              <div>Scope: as validated in pilot {pilot.code}</div>
              <div>Trial duration: {pilot.durationWeeks} weeks</div>
              <div>
                Milestones verified: {verifiedMilestonesCount} of {totalMilestonesCount}
              </div>
            </div>
          </div>
        </div>

        {/* Signatures & Seals */}
        <div className="pt-8 border-t border-[var(--ink)] grid grid-cols-2 gap-8 text-xs font-sans">
          <div>
            <div className="font-mono-data font-bold text-[var(--ink)]">
              {pilot.leadOfficerName}
            </div>
            <div className="text-[11px] text-[var(--ink-muted)]">
              Competent Sanctioning Authority · {pilot.department}
            </div>
            {isProcured && pilot.sanctionDocketId ? (
              <AuditStamp
                actorName={pilot.leadOfficerName}
                actorRole="Sanctioning Officer"
                timestamp={sanctionOrderRef}
                hash={pilot.sanctionDocketId.slice(0, 8)}
                className="mt-2"
              />
            ) : (
              <div className="mt-2 text-[11px] font-mono-data text-[var(--ink-muted)]">Unsigned draft</div>
            )}
          </div>

          <div className="text-right">
            <div className="font-mono-data font-bold text-[var(--ink)]">
              {pilot.independentValidatorName}
            </div>
            <div className="text-[11px] text-[var(--ink-muted)]">
              Independent Technical Validator
            </div>
            <div className="inline-block mt-2 px-2 py-0.5 rounded bg-[var(--positive-soft)] text-[var(--positive)] border border-[var(--positive)]/30 font-mono-data text-[11px]">
              {verifiedMilestonesCount} of {totalMilestonesCount} milestones verified
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar (Print / record procurement) */}
      <div className="p-4 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-3 shadow-2xs print:hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Button variant="secondary" size="md" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            <span>Print / Save as PDF</span>
          </Button>

          <div>
            {isProcured ? (
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--positive)] font-mono-data">
                <CheckCircle2 className="w-4 h-4" />
                <span>Procurement recorded · {sanctionOrderRef}</span>
              </div>
            ) : pilot.status === "Recommended for procurement" && canRecord ? (
              <Button variant="primary" size="md" onClick={handleRecordProcurement} disabled={recording}>
                <Send className="w-4 h-4" />
                <span>{recording ? "Recording..." : "Record Procurement Sanction →"}</span>
              </Button>
            ) : (
              <span className="text-xs font-mono-data text-[var(--ink-muted)]">
                {pilot.status === "Recommended for procurement"
                  ? "Awaiting the lead officer to record the sanction"
                  : "Recommend the pilot for procurement from the pilot tracker first"}
              </span>
            )}
          </div>
        </div>

        {recordError && (
          <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-[6px] text-xs text-[var(--danger)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{recordError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
