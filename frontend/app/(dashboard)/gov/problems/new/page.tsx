"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PlusCircle, CheckCircle2, Shield } from "lucide-react";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { Problem, TRL } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export default function PostNewProblemPage() {
  const router = useRouter();
  const session = getSession();

  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState(
    session?.department || "Division of Precision Agriculture & Drone Systems"
  );
  const [ministry, setMinistry] = useState(session?.orgName || "Indian Council of Agricultural Research (ICAR)");
  const [domain, setDomain] = useState<Problem["domain"]>("DroneTech");
  const [description, setDescription] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [budgetBand, setBudgetBand] = useState<Problem["budgetBand"]>("₹25L–₹50L");
  const [targetTRL, setTargetTRL] = useState<TRL>("TRL-6");
  const [deadline, setDeadline] = useState("2026-11-30");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const created = await api.createProblem({
        title,
        department,
        ministry,
        domain,
        description,
        desiredOutcome,
        budgetBand,
        targetTRL,
        deadline,
      });

      router.push("/gov/problems");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/gov/problems"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)] hover:text-[var(--accent)] font-medium"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to My Problems</span>
      </Link>

      <PageHeader
        code="CHALLENGE-INTAKE"
        title="Publish New Operational Challenge"
        subtitle="Define department technical specifications, operational bottlenecks, and acceptance benchmarks for startup bidding."
      />

      <form onSubmit={handleSubmit} className="space-y-6 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] p-6 shadow-2xs">
        <div className="space-y-4">
          <Input
            label="Operational Challenge Title"
            placeholder="e.g. Autonomous Multispectral Weed Detection & Micro-Boom Spraying"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Issuing Ministry / Agency"
              value={ministry}
              onChange={(e) => setMinistry(e.target.value)}
              required
            />
            <Input
              label="Department / Directorate"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Domain Category"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              options={[
                { value: "DroneTech", label: "DroneTech & Aerospace" },
                { value: "AgriTech", label: "AgriTech & Farm Mechanization" },
                { value: "Defence", label: "Defence & Border Security" },
                { value: "HealthTech", label: "HealthTech & Diagnostics" },
                { value: "GovTech", label: "GovTech & Civic Infrastructure" },
                { value: "CleanTech", label: "CleanTech & Water Systems" },
              ]}
            />

            <Select
              label="Target Budget Band"
              value={budgetBand}
              onChange={(e) => setBudgetBand(e.target.value)}
              options={[
                { value: "< ₹10L", label: "Under ₹10 Lakhs (Micro-Trial)" },
                { value: "₹10L–₹25L", label: "₹10 Lakhs – ₹25 Lakhs" },
                { value: "₹25L–₹50L", label: "₹25 Lakhs – ₹50 Lakhs" },
                { value: "> ₹50L", label: "Above ₹50 Lakhs (Large Scale)" },
              ]}
            />

            <Select
              label="Minimum Required TRL"
              value={targetTRL}
              onChange={(e) => setTargetTRL(e.target.value as TRL)}
              options={[
                { value: "TRL-4", label: "TRL-4 (Lab Proven)" },
                { value: "TRL-5", label: "TRL-5 (Integrated Rig)" },
                { value: "TRL-6", label: "TRL-6 (Field Prototype)" },
                { value: "TRL-7", label: "TRL-7 (Operational)" },
              ]}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--ink-secondary)] uppercase tracking-wider block mb-1.5">
              Detailed Operational Problem Narrative <span className="text-[var(--danger)]">*</span>
            </label>
            <textarea
              rows={4}
              required
              placeholder="Describe current operational constraints, existing equipment failures, and environmental conditions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[var(--surface-raised)] border border-[var(--line)] rounded-[6px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--ink-secondary)] uppercase tracking-wider block mb-1.5">
              Technical Acceptance Criteria & Target Outcome <span className="text-[var(--danger)]">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="Define quantitative benchmarks (e.g. accuracy %, latency, endurance, operating temperature) required for pilot verification..."
              value={desiredOutcome}
              onChange={(e) => setDesiredOutcome(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[var(--surface-raised)] border border-[var(--line)] rounded-[6px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <Input
            label="Proposal Submission Deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
          />
        </div>

        <div className="pt-4 border-t border-[var(--line)] flex justify-end gap-3">
          <Link href="/gov/problems">
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </Link>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Publishing Challenge..." : "Publish Challenge to Startup Hub"}
          </Button>
        </div>
      </form>
    </div>
  );
}
