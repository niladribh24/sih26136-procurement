"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Plus, Trash2, Rocket, AlertCircle, Clock } from "lucide-react";
import { Solution, Problem } from "@/lib/types";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export interface PilotSetupPanelProps {
  solution: Solution;
  problem: Problem;
  onClose: () => void;
}

export const PilotSetupPanel: React.FC<PilotSetupPanelProps> = ({
  solution,
  problem,
  onClose,
}) => {
  const router = useRouter();

  const [durationWeeks, setDurationWeeks] = useState(solution.proposedDurationWeeks.toString() || "8");
  const [totalBudget, setTotalBudget] = useState(solution.proposedCost.toString() || "2850000");
  const [independentValidator, setIndependentValidator] = useState("Prof. K. Rao (Aerospace, IIT Delhi)");
  const [isLaunching, setIsLaunching] = useState(false);

  const [milestones, setMilestones] = useState([
    {
      sequence: 1,
      title: "Bench Calibration & Optical Sensor Synchronization",
      description: "Laboratory synchronization of sensor telemetry with edge compute board.",
      targetKPI: "Frame-drop rate < 0.1% over 24-hr continuous run",
      deliverableDueWeek: 2,
      tranchePercentage: 30,
    },
    {
      sequence: 2,
      title: "Live Field Canopy Penetration Flight Tests",
      description: "Autonomous field test flights across simulated forest testbed.",
      targetKPI: "False-positive detection rate < 8% under canopy",
      deliverableDueWeek: 5,
      tranchePercentage: 40,
    },
    {
      sequence: 3,
      title: "Encrypted Mesh Telemetry & Ground Alert Handoff",
      description: "Real-time threat alert packet relay over 5km distance without cellular coverage.",
      targetKPI: "Alert packet latency < 1.2s at 5km range",
      deliverableDueWeek: 8,
      tranchePercentage: 30,
    },
  ]);

  const handleLaunchPilot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLaunching(true);

    const numericBudget = parseInt(totalBudget, 10) || 2850000;

    try {
      const createdPilot = await api.createPilot({
        problemId: problem.id,
        solutionId: solution.id,
        startupId: solution.startupId,
        startupName: solution.startupName,
        dpiitNumber: solution.dpiitNumber,
        department: problem.department,
        ministry: problem.ministry,
        leadOfficerName: "Dr. A. Sharma (Director, ICAR)",
        independentValidatorName: independentValidator,
        durationWeeks: parseInt(durationWeeks, 10) || 8,
        totalBudget: numericBudget,
        performanceScore: 0,
        milestones: milestones.map((m) => ({
          id: `m-${Date.now()}-${m.sequence}`,
          pilotId: "",
          sequence: m.sequence,
          title: m.title,
          description: m.description,
          targetKPI: m.targetKPI,
          deliverableDueWeek: m.deliverableDueWeek,
          tranchePercentage: m.tranchePercentage,
          trancheAmount: Math.round((numericBudget * m.tranchePercentage) / 100),
          status: "pending",
        })),
      });

      // Update solution status
      solution.status = "shortlisted";
      onClose();
      router.push(`/gov/pilots/${createdPilot.id}`);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="p-5 bg-[var(--surface)] border border-[var(--accent)]/30 rounded-[8px] space-y-5">
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--accent)] font-editorial flex items-center gap-1.5">
            <Rocket className="w-4 h-4" />
            <span>Approve & Configure Time-Boxed Pilot Trial</span>
          </h3>
          <p className="text-[11px] text-[var(--ink-muted)]">
            Vendor: {solution.startupName} ({solution.dpiitNumber})
          </p>
        </div>
      </div>

      <form onSubmit={handleLaunchPilot} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Total Grant Budget (₹)"
            type="number"
            value={totalBudget}
            onChange={(e) => setTotalBudget(e.target.value)}
            required
          />

          <Input
            label="Trial Duration (Weeks)"
            type="number"
            value={durationWeeks}
            onChange={(e) => setDurationWeeks(e.target.value)}
            required
          />
        </div>

        {/* Conflict-of-Interest Guard */}
        <div className="p-3 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[6px] space-y-1.5">
          <label className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[var(--positive)]" />
            <span>Appointed Independent Technical Validator</span>
          </label>
          <Select
            value={independentValidator}
            onChange={(e) => setIndependentValidator(e.target.value)}
            options={[
              { value: "Prof. K. Rao (Aerospace, IIT Delhi)", label: "Prof. K. Rao (IIT Delhi) — Aerospace & Drone Systems" },
              { value: "Dr. Sunita Sen (Senior Scientist, CSIR-NAL)", label: "Dr. Sunita Sen (CSIR-NAL) — Flight Mechanics" },
              { value: "Col. P. Varma (Retd., Defence Research Cell)", label: "Col. P. Varma (Retd.) — Tactical Telecom" },
            ]}
            helperText="Conflict-of-interest rule: Validator must be independent of the initial proposal evaluator."
          />
        </div>

        {/* Milestones Schedule */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ink)]">
              Structured Milestones & Payment Tranches:
            </span>
            <span className="text-[11px] font-mono-data text-[var(--accent)]">
              Total: 100%
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {milestones.map((m, idx) => (
              <div
                key={m.sequence}
                className="p-3 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[6px] text-xs space-y-1.5"
              >
                <div className="flex justify-between font-semibold text-[var(--ink)]">
                  <span>Milestone {m.sequence}: {m.title}</span>
                  <span className="font-mono-data text-[var(--accent)]">
                    {m.tranchePercentage}% Tranche (Week {m.deliverableDueWeek})
                  </span>
                </div>
                <div className="text-[11px] text-[var(--ink-secondary)]">
                  KPI: {m.targetKPI}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-[var(--line)] flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={isLaunching}>
            {isLaunching ? "Initializing Pilot..." : "Sanction & Launch Active Pilot →"}
          </Button>
        </div>
      </form>
    </div>
  );
};
