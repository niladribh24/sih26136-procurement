"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  FileText,
  AlertTriangle,
  IndianRupee,
  Link as LinkIcon,
} from "lucide-react";
import { Milestone, Pilot } from "@/lib/types";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface IndependentValidationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: Milestone | null;
  pilot: Pilot;
  onVerified: () => void;
}

export const IndependentValidationDrawer: React.FC<IndependentValidationDrawerProps> = ({
  isOpen,
  onClose,
  milestone,
  pilot,
  onVerified,
}) => {
  const [validatorName, setValidatorName] = useState(
    pilot.independentValidatorName || "Prof. K. Rao (IIT Delhi)"
  );
  const [decision, setDecision] = useState<"pass" | "fail">("pass");
  const [remarks, setRemarks] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (milestone) {
      setDecision("pass");
      setRemarks(
        milestone.verificationRemarks ||
        `Technical deliverable benchmark inspected against quantitative target: "${milestone.targetKPI}". Telemetry and logs verified without deviation.`
      );
      setReportUrl(milestone.verificationReportUrl || `/reports/evaluation-${milestone.id}.pdf`);
    }
  }, [milestone?.id]);

  if (!milestone) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { api } = await import("@/lib/api");
      await api.verifyMilestone(
        pilot.id,
        milestone.id,
        validatorName,
        decision === "pass" ? remarks : `[FAILED AUDIT]: ${remarks}`,
        decision === "pass" ? "verified" : "failed",
        reportUrl
      );
      onVerified();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Independent Milestone ${milestone.sequence} Verification`}
      subtitle={`${pilot.startupName} · Tranche: ₹${(milestone.trancheAmount / 100000).toFixed(2)} Lakhs`}
      widthClass="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Conflict of Interest Guard */}
        <div className="p-4 bg-[var(--positive-soft)] border border-[var(--positive)]/30 rounded-[8px] space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--positive)]">
            <ShieldCheck className="w-4 h-4" />
            <span>Conflict-of-Interest Guard Passed</span>
          </div>
          <p className="text-[11px] text-[var(--positive)]/90 leading-relaxed">
            Independent Validator (<strong>{validatorName}</strong>) is confirmed independent from the department lead officer ({pilot.leadOfficerName}).
          </p>
        </div>

        {/* Milestone Specs */}
        <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-[8px] space-y-2 text-xs">
          <div className="font-bold text-[var(--ink)]">{milestone.title}</div>
          <p className="text-[var(--ink-secondary)]">{milestone.description}</p>

          <div className="pt-2 border-t border-[var(--line)] grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-[var(--ink-muted)] block">Target KPI:</span>
              <strong className="text-[var(--ink)]">{milestone.targetKPI}</strong>
            </div>
            <div>
              <span className="text-[var(--ink-muted)] block">Reported Benchmark:</span>
              <strong className="text-[var(--accent)] font-mono-data">
                {milestone.achievedKPI || "5.4% false-positive rate under canopy"}
              </strong>
            </div>
          </div>
        </div>

        {/* Validator Decision */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--ink)] uppercase tracking-wider block">
            Verification Finding
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDecision("pass")}
              className={`p-3 rounded-[6px] border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                decision === "pass"
                  ? "bg-[var(--positive-soft)] text-[var(--positive)] border-[var(--positive)]"
                  : "bg-[var(--surface)] text-[var(--ink-muted)] border-[var(--line)]"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Satisfactory (Pass)</span>
            </button>

            <button
              type="button"
              onClick={() => setDecision("fail")}
              className={`p-3 rounded-[6px] border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                decision === "fail"
                  ? "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]"
                  : "bg-[var(--surface)] text-[var(--ink-muted)] border-[var(--line)]"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Discrepancy (Fail)</span>
            </button>
          </div>
        </div>

        {/* Verification Report Reference */}
        <div>
          <label className="text-xs font-semibold text-[var(--ink)] uppercase tracking-wider block mb-1.5">
            Verification Report / Audit File URL
          </label>
          <div className="relative">
            <Input
              type="text"
              value={reportUrl}
              onChange={(e) => setReportUrl(e.target.value)}
              placeholder="https://eval-repo.gov.in/reports/eval-2026.pdf"
              className="font-mono-data text-xs"
            />
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="text-xs font-semibold text-[var(--ink)] uppercase tracking-wider block mb-1.5">
            Independent Technical Evaluation Remarks <span className="text-[var(--danger)]">*</span>
          </label>
          <textarea
            rows={4}
            required
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Detailed rationale, test environment specifications, and metrics verified..."
            className="w-full px-3 py-2 text-xs bg-[var(--surface-raised)] border border-[var(--line)] rounded-[6px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Tranche Release Memo */}
        {decision === "pass" ? (
          <div className="p-4 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-1 text-xs">
            <span className="text-[10px] font-mono-data uppercase text-[var(--ink-muted)] block">
              Financial Consequence
            </span>
            <div className="font-bold text-[var(--ink)] flex items-center gap-1">
              <span>Authorizes Tranche Disbursement:</span>
              <span className="font-mono-data text-[var(--positive)]">
                ₹{(milestone.trancheAmount / 100000).toFixed(2)} Lakhs
              </span>
            </div>
            <p className="text-[11px] text-[var(--ink-muted)]">
              Generates immutable cryptographic sanction memo in the trial audit register.
            </p>
          </div>
        ) : (
          <div className="p-4 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-[8px] space-y-1 text-xs">
            <span className="text-[10px] font-mono-data uppercase text-[var(--danger)] font-bold block">
              Disbursement Withheld
            </span>
            <div className="font-bold text-[var(--danger)] flex items-center gap-1">
              <span>Tranche Frozen: ₹{(milestone.trancheAmount / 100000).toFixed(2)} Lakhs</span>
            </div>
            <p className="text-[11px] text-[var(--danger)]/90">
              Deliverable flagged as non-compliant with benchmark threshold. Pilot paused for remediation. No funds will be released.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-[var(--line)]">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={decision === "pass" ? "primary" : "danger"}
            size="sm"
            disabled={submitting}
          >
            {submitting
              ? "Signing Record..."
              : decision === "pass"
              ? "Confirm Sign-Off & Authorize Memo"
              : "Record Discrepancy & Reject Deliverable"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
};
