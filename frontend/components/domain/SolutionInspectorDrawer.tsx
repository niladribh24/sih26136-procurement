"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Sliders,
  FileText,
  Rocket,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Solution, Problem } from "@/lib/types";
import { api } from "@/lib/api";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PilotSetupPanel } from "./PilotSetupPanel";

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
  const [techMerit, setTechMerit] = useState(solution?.rubricScore?.technicalMerit || 28);
  const [costRealism, setCostRealism] = useState(solution?.rubricScore?.costRealism || 18);
  const [teamCap, setTeamCap] = useState(solution?.rubricScore?.teamCapability || 19);
  const [timelineViab, setTimelineViab] = useState(solution?.rubricScore?.timelineViability || 27);
  const [savedRubric, setSavedRubric] = useState(false);

  if (!solution) return null;

  const totalScore = techMerit + costRealism + teamCap + timelineViab;

  const handleSaveRubric = async () => {
    await api.updateSolutionRubric(solution.id, {
      technicalMerit: techMerit,
      costRealism: costRealism,
      teamCapability: teamCap,
      timelineViability: timelineViab,
    });
    setSavedRubric(true);
    setTimeout(() => setSavedRubric(false), 2000);
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
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--ink)]">
                {solution.title}
              </span>
              <Badge variant="dpiit_verified">
                <ShieldCheck className="w-3 h-3 mr-1" />
                DPIIT VERIFIED
              </Badge>
            </div>
            <div className="text-xs font-mono-data text-[var(--ink-muted)] mt-1">
              Proposed Budget: ₹{(solution.proposedCost / 100000).toFixed(1)}L · Duration: {solution.proposedDurationWeeks} Weeks · {solution.claimedTRL}
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono-data text-[var(--ink-muted)] block">
              Cosine Similarity
            </span>
            <span className="text-base font-bold font-mono-data text-[var(--highlight)]">
              {Math.round(solution.matchScore * 100)}% Match
            </span>
          </div>
        </div>

        {/* Side-by-Side Comparison: Problem Requirement vs Solution Excerpt */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono-data uppercase tracking-wider text-[var(--ink-muted)] font-semibold">
            Side-by-Side Semantic Matching
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
                Startup Proposal Excerpt (Matched):
              </span>
              <p className="text-[var(--ink)] leading-relaxed">
                {solution.abstract}
              </p>
            </div>
          </div>
        </div>

        {/* Automated Eligibility Checks */}
        <div className="p-4 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-2">
          <h3 className="text-xs font-mono-data uppercase tracking-wider text-[var(--ink-muted)] font-semibold">
            Automated Statutory Eligibility (GFR Rule 149)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1.5 p-2 rounded bg-[var(--positive-soft)] text-[var(--positive)] border border-[var(--positive)]/30">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>DPIIT Recognition Verified</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded bg-[var(--positive-soft)] text-[var(--positive)] border border-[var(--positive)]/30">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Turnover &lt; ₹25Cr</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 rounded bg-[var(--positive-soft)] text-[var(--positive)] border border-[var(--positive)]/30">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Domain Aligned ({problem.domain})</span>
            </div>
          </div>
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
