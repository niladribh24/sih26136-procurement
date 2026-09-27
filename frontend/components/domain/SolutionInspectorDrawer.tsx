"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Sliders,
  FileText,
  Rocket,
  ChevronDown,
  ChevronUp,
  XCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Solution, Problem, Eligibility, EligibilityRuleStatus, isMatchPending } from "@/lib/types";
import { api } from "@/lib/api";
import { ApiError, errorMessage } from "@/lib/http";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PilotSetupPanel } from "./PilotSetupPanel";

const RULE_STYLE: Record<EligibilityRuleStatus, string> = {
  pass: "bg-[var(--positive-soft)] text-[var(--positive)] border-[var(--positive)]/30",
  fail: "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/30",
  pending: "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]/30",
};

const ELIGIBILITY_BADGE = {
  eligible: "positive",
  ineligible: "danger",
  pending: "warning",
} as const;

const RuleIcon: React.FC<{ status: EligibilityRuleStatus }> = ({ status }) =>
  status === "pass" ? (
    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
  ) : status === "fail" ? (
    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
  ) : (
    <Clock className="w-4 h-4 shrink-0 mt-0.5" />
  );

export interface SolutionInspectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  solution: Solution | null;
  problem: Problem;
}

export const SolutionInspectorDrawer: React.FC<SolutionInspectorDrawerProps> = ({
  isOpen,
  onClose,
  solution,
  problem,
}) => {
  const [showPilotSetup, setShowPilotSetup] = useState(false);

  // Evaluator Rubric State
  const [techMerit, setTechMerit] = useState(28);
  const [costRealism, setCostRealism] = useState(18);
  const [teamCap, setTeamCap] = useState(19);
  const [timelineViab, setTimelineViab] = useState(27);
  const [savedRubric, setSavedRubric] = useState(false);
  const [rubricError, setRubricError] = useState("");

  // Eligibility is computed server-side on submission; the drawer just reads it. The result is
  // tagged with its solution id, so switching solutions shows "loading" without a reset in the effect.
  const [eligibilityResult, setEligibilityResult] = useState<{
    solutionId: string;
    data: Eligibility | null;
    error: string;
  } | null>(null);
  const [eligibilityBusy, setEligibilityBusy] = useState(false);

  const solutionId = solution?.id;
  useEffect(() => {
    if (!isOpen || !solutionId) return;
    let cancelled = false;
    api
      .getEligibility(solutionId)
      .then((data) => {
        if (!cancelled) setEligibilityResult({ solutionId, data, error: "" });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setEligibilityResult({ solutionId, data: null, error: errorMessage(err, "Could not load eligibility.") });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, solutionId]);

  const currentEligibility = eligibilityResult?.solutionId === solutionId ? eligibilityResult : null;
  const eligibility = currentEligibility?.data ?? null;
  const eligibilityError = currentEligibility?.error ?? "";

  useEffect(() => {
    if (solution) {
      setTechMerit(solution.rubricScore?.technicalMerit ?? 28);
      setCostRealism(solution.rubricScore?.costRealism ?? 18);
      setTeamCap(solution.rubricScore?.teamCapability ?? 19);
      setTimelineViab(solution.rubricScore?.timelineViability ?? 27);
      setShowPilotSetup(false);
      setSavedRubric(false);
      setRubricError("");
    }
  }, [solution?.id]);

  if (!solution) return null;

  const totalScore = techMerit + costRealism + teamCap + timelineViab;

  const matchPending = isMatchPending(solution);

  const handleSaveRubric = async () => {
    setRubricError("");
    try {
      await api.updateSolutionRubric(solution.id, {
        technicalMerit: techMerit,
        costRealism: costRealism,
        teamCapability: teamCap,
        timelineViability: timelineViab,
      });
    } catch (err) {
      setRubricError(errorMessage(err, "Could not save the rubric score."));
      return;
    }
    setSavedRubric(true);
    setTimeout(() => setSavedRubric(false), 2000);
  };

  const handleRecheckEligibility = async () => {
    const id = solution.id;
    setEligibilityBusy(true);
    try {
      setEligibilityResult({ solutionId: id, data: await api.rerunEligibility(id), error: "" });
    } catch (err) {
      const error =
        err instanceof ApiError && err.status === 403
          ? "Only the officer who posted this problem, or an evaluator, can re-run the check."
          : errorMessage(err, "Eligibility re-check failed.");
      // Keep showing the last result alongside the error
      setEligibilityResult((prev) => ({ solutionId: id, data: prev?.solutionId === id ? prev.data : null, error }));
    } finally {
      setEligibilityBusy(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={solution.startupName}
      subtitle={`Technical Proposal Inspection · Ref: ${solution.id}`}
      widthClass="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Top Summary Banner */}
        <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-[8px] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-[var(--ink)]">
                {solution.title}
              </span>
              {solution.dpiitVerified ? (
                <Badge variant="dpiit_verified">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  DPIIT: {solution.dpiitNumber}
                </Badge>
              ) : (
                <Badge variant="warning">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  DPIIT: PENDING
                </Badge>
              )}
            </div>
            <div className="text-xs font-mono-data text-[var(--ink-muted)] mt-1">
              Proposed Budget: {solution.proposedCost ? `₹${(solution.proposedCost / 100000).toFixed(1)}L` : "TBD"} · Duration: {solution.proposedDurationWeeks || 8} Weeks · {solution.claimedTRL || "TRL 6"}
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-mono-data text-[var(--ink-muted)] block">
              Requirement Match
            </span>
            <span className="text-base font-bold font-mono-data text-[var(--highlight)]">
              {matchPending ? "Pending" : `${Math.round((solution.matchScore || 0) * 100)}% Fit`}
            </span>
          </div>
        </div>

        {/* Side-by-Side Comparison: Problem Requirement vs Solution Excerpt */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono-data uppercase tracking-wider text-[var(--ink-muted)] font-semibold">
            Requirement Alignment & Criteria Verification
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-[6px] space-y-1">
              <span className="text-[10px] font-mono-data uppercase text-[var(--accent)] font-bold block">
                Department Problem Requirement:
              </span>
              <p className="text-[var(--ink-secondary)] leading-relaxed">
                {problem.desiredOutcome}
              </p>
            </div>

            <div className="p-3 bg-[var(--highlight-soft)] border border-[var(--highlight)]/30 rounded-[6px] space-y-1">
              <span className="text-[10px] font-mono-data uppercase text-[var(--highlight)] font-bold block">
                Startup Proposal Excerpt:
              </span>
              <p className="text-[var(--ink)] leading-relaxed">
                {solution.abstract}
              </p>
            </div>
          </div>

          {solution.matchExplanation && (
            <div className="p-3 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[6px] space-y-1 text-xs">
              <span className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--ink-muted)] block font-semibold">
                Match Rationale:
              </span>
              <p className="text-[var(--ink-secondary)] leading-relaxed">{solution.matchExplanation}</p>
            </div>
          )}

          {solution.matchedKeywords && solution.matchedKeywords.length > 0 && (
            <div className="p-3 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[6px] space-y-1.5 text-xs">
              <span className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--ink-muted)] block font-semibold">
                Verified Technical Keyword Matches:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {solution.matchedKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 rounded-[4px] bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)] text-[11px] font-mono-data"
                  >
                    ✓ {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Automated Eligibility Checks */}
        <div className="p-4 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-mono-data uppercase tracking-wider text-[var(--ink-muted)] font-semibold">
              Automated Statutory Eligibility (GFR Rule 149)
            </h3>
            {eligibility && (
              <Badge variant={ELIGIBILITY_BADGE[eligibility.status]}>
                {eligibility.status.toUpperCase()}
              </Badge>
            )}
          </div>

          {eligibilityError && <div className="text-xs text-[var(--danger)]">{eligibilityError}</div>}

          {!eligibility && !eligibilityError && (
            <div className="text-xs font-mono-data text-[var(--ink-muted)]">Loading eligibility checks...</div>
          )}

          {eligibility && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {eligibility.rules.map((r) => (
                  <div key={r.rule} className={`flex items-start gap-1.5 p-2 rounded border ${RULE_STYLE[r.status]}`}>
                    <RuleIcon status={r.status} />
                    <div>
                      <div className="font-semibold">{r.label}</div>
                      <div className="text-[11px] opacity-90">{r.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-mono-data text-[var(--ink-muted)]">
                  Checked: {new Date(eligibility.checkedAt).toLocaleString("en-IN")}
                </span>
                <Button variant="ghost" size="sm" onClick={handleRecheckEligibility} disabled={eligibilityBusy}>
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${eligibilityBusy ? "animate-spin" : ""}`} />
                  Re-check
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Evaluator Rubric Panel */}
        <div className="p-5 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
            <div>
              <h3 className="text-sm font-bold text-[var(--ink)] font-editorial flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-[var(--accent)]" />
                <span>Technical Evaluation Rubric Scoring</span>
              </h3>
              <p className="text-[11px] text-[var(--ink-muted)]">
                Scored by Department Evaluation Committee
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono-data text-[var(--ink-muted)]">Total Score:</span>
              <span className="text-sm font-bold font-mono-data text-[var(--accent)] ml-1.5">
                {totalScore} / 100
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[var(--ink)] block mb-1">
                Technical Merit & Novelty (Max 30)
              </label>
              <input
                type="number"
                min={0}
                max={30}
                value={techMerit}
                onChange={(e) => setTechMerit(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--line)] rounded-[4px] font-mono-data"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--ink)] block mb-1">
                Cost Realism & Efficiency (Max 20)
              </label>
              <input
                type="number"
                min={0}
                max={20}
                value={costRealism}
                onChange={(e) => setCostRealism(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--line)] rounded-[4px] font-mono-data"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--ink)] block mb-1">
                Team Capability & Past Experience (Max 20)
              </label>
              <input
                type="number"
                min={0}
                max={20}
                value={teamCap}
                onChange={(e) => setTeamCap(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--line)] rounded-[4px] font-mono-data"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--ink)] block mb-1">
                Timeline & Field Viability (Max 30)
              </label>
              <input
                type="number"
                min={0}
                max={30}
                value={timelineViab}
                onChange={(e) => setTimelineViab(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--line)] rounded-[4px] font-mono-data"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            {savedRubric ? (
              <span className="text-xs text-[var(--positive)] flex items-center gap-1 font-mono-data">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Rubric score saved!
              </span>
            ) : rubricError ? (
              <span className="text-xs text-[var(--danger)] flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {rubricError}
              </span>
            ) : <span />}

            <Button variant="secondary" size="sm" onClick={handleSaveRubric}>
              Save Rubric Score
            </Button>
          </div>
        </div>

        {/* Pilot Transition Section */}
        {!showPilotSetup ? (
          <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-[8px] flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-[var(--ink)]">
                Ready to Initiate Field Trial?
              </h4>
              <p className="text-[11px] text-[var(--ink-muted)]">
                Approve proposal and configure milestone timeline and payment tranches.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowPilotSetup(true)}
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Approve & Configure Pilot</span>
            </Button>
          </div>
        ) : (
          <PilotSetupPanel
            solution={solution}
            problem={problem}
            onClose={() => setShowPilotSetup(false)}
          />
        )}
      </div>
    </Drawer>
  );
};
