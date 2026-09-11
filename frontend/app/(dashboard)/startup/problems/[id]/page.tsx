"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Calendar,
  IndianRupee,
  Layers,
  FileUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Building2,
} from "lucide-react";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { Problem, TRL } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export default function StartupProblemSubmissionPage() {
  const params = useParams();
  const router = useRouter();
  const problemId = params.id as string;

  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);

  // Proposal Form State
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [claimedTRL, setClaimedTRL] = useState<TRL>("TRL-6");
  const [proposedCost, setProposedCost] = useState("2850000");
  const [proposedDurationWeeks, setProposedDurationWeeks] = useState("8");
  const [pdfFileName, setPdfFileName] = useState("AeroKisan_Canopy_Surveillance_Proposal.pdf");
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    api.getProblem(problemId).then((data) => {
      setProblem(data);
      setLoading(false);
    });
  }, [problemId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem) return;

    setSubmitting(true);
    const session = getSession();

    try {
      const result = await api.submitSolution({
        problemId: problem.id,
        startupId: session?.id || "user-startup-01",
        startupName: session?.orgName || "AeroKisan Technologies Pvt Ltd",
        dpiitNumber: session?.dpiitNumber || "DIPP98234",
        dpiitVerified: true,
        location: "Bengaluru, Karnataka",
        title: title || `Integrated Technical Solution for ${problem.code}`,
        abstract:
          abstract ||
          "Autonomous modular solution integrating specialized sensors and localized edge processing to address operational constraints outlined in the challenge statement.",
        claimedTRL,
        proposedCost: parseInt(proposedCost, 10) || 2500000,
        proposedDurationWeeks: parseInt(proposedDurationWeeks, 10) || 8,
        pdfUrl: `/proposals/${pdfFileName}`,
      });

      setSubmittedId(result.id);
      setTimeout(() => {
        router.push("/startup/proposals");
      }, 2500);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-[var(--ink-muted)]">Loading challenge specifications...</div>;
  }

  if (!problem) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm text-[var(--ink)]">Operational challenge not found.</p>
        <Link href="/startup/problems">
          <Button variant="secondary" size="sm">
            Back to Problem Browser
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <Link
        href="/startup/problems"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)] hover:text-[var(--accent)] font-medium"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Open Challenges</span>
      </Link>

      <PageHeader
        code={problem.code}
        title={problem.title}
        subtitle={`${problem.department} · ${problem.ministry}`}
        badge={<Badge variant="info">{problem.domain}</Badge>}
      />

      {submittedId && (
        <div className="p-4 bg-[var(--positive-soft)] border border-[var(--positive)]/40 rounded-[8px] flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[var(--positive)] shrink-0" />
          <div>
            <div className="text-xs font-bold text-[var(--positive)]">
              Proposal Successfully Submitted! (ID: {submittedId})
            </div>
            <div className="text-[11px] text-[var(--positive)]/80">
              Triggered background NLP summarization and semantic match scoring. Redirecting to proposal tracker...
            </div>
          </div>
        </div>
      )}

      {/* Split Two-Column View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Problem Specifications (5 cols) */}
        <div className="lg:col-span-5 space-y-6 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] p-6 shadow-2xs">
          <div>
            <h3 className="text-xs font-mono-data uppercase tracking-wider text-[var(--ink-muted)] font-semibold">
              Operational Challenge Context
            </h3>
            <p className="text-xs text-[var(--ink)] mt-2 leading-relaxed whitespace-pre-line">
              {problem.description}
            </p>
          </div>

          <div className="p-4 bg-[var(--surface)] border border-[var(--line)] rounded-[6px] space-y-2">
            <h4 className="text-xs font-semibold text-[var(--accent)] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[var(--positive)]" />
              <span>Target Acceptance Criteria</span>
            </h4>
            <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
              {problem.desiredOutcome}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-3 bg-[var(--surface-subtle)] border border-[var(--line)] rounded-[6px]">
              <span className="text-[10px] font-mono-data text-[var(--ink-muted)] uppercase block">
                Sanction Budget Band
              </span>
              <span className="text-sm font-bold text-[var(--ink)] font-mono-data">
                {problem.budgetBand}
              </span>
            </div>

            <div className="p-3 bg-[var(--surface-subtle)] border border-[var(--line)] rounded-[6px]">
              <span className="text-[10px] font-mono-data text-[var(--ink-muted)] uppercase block">
                Required Baseline TRL
              </span>
              <span className="text-sm font-bold text-[var(--ink)] font-mono-data">
                {problem.targetTRL}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--line)] text-xs text-[var(--ink-muted)] flex items-center justify-between">
            <span>Deadline: {problem.deadline}</span>
            <span className="font-mono-data">Total Submissions: {problem.submissionCount}</span>
          </div>
        </div>

        {/* Right Column: Technical Proposal Submission Form (7 cols) */}
        <div className="lg:col-span-7 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] p-6 shadow-2xs">
          <div className="border-b border-[var(--line)] pb-4 mb-6">
            <h2 className="text-base font-bold text-[var(--ink)] font-editorial">
              Submit Technical Solution Proposal
            </h2>
            <p className="text-xs text-[var(--ink-muted)] mt-0.5">
              Submit your architectural abstract and technical proposal PDF for AI match ranking.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Solution Proposal Title"
              placeholder="e.g. Dual-Stream SWIR Optical Payload with Edge Thermal Clustering"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <div>
              <label className="text-xs font-medium text-[var(--ink-secondary)] uppercase tracking-wider block mb-1.5">
                Executive Pitch Abstract <span className="text-[var(--danger)]">*</span>
              </label>
              <textarea
                rows={4}
                required
                placeholder="Describe your technical methodology, sensor payload, compute architecture, and field deployment plan..."
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--surface-raised)] border border-[var(--line)] rounded-[6px] text-[var(--ink)] placeholder-[var(--ink-muted)] focus:outline-none focus:border-[var(--accent)]"
              />
              <span className="text-[10px] text-[var(--ink-muted)]">
                The NLP microservice distills this into a 2–4 sentence summary and calculates cosine similarity.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Claimed TRL"
                value={claimedTRL}
                onChange={(e) => setClaimedTRL(e.target.value as TRL)}
                options={[
                  { value: "TRL-4", label: "TRL-4 (Lab Prototype)" },
                  { value: "TRL-5", label: "TRL-5 (Integrated Rig)" },
                  { value: "TRL-6", label: "TRL-6 (Field Tested)" },
                  { value: "TRL-7", label: "TRL-7 (Operational)" },
                  { value: "TRL-8", label: "TRL-8 (Qualified)" },
                ]}
              />

              <Input
                label="Estimated Cost (₹)"
                type="number"
                value={proposedCost}
                onChange={(e) => setProposedCost(e.target.value)}
                required
              />

              <Input
                label="Timeline (Weeks)"
                type="number"
                value={proposedDurationWeeks}
                onChange={(e) => setProposedDurationWeeks(e.target.value)}
                required
              />
            </div>

            {/* Proposal PDF Upload */}
            <div className="border border-dashed border-[var(--line-strong)] rounded-[6px] p-4 bg-[var(--surface)] text-center">
              <FileUp className="w-6 h-6 text-[var(--accent)] mx-auto mb-1.5" />
              <div className="text-xs font-medium text-[var(--ink)]">
                {pdfFileName ? (
                  <span className="font-mono-data text-[var(--accent)]">{pdfFileName}</span>
                ) : (
                  <span>Attach Technical Proposal PDF (Max 15MB)</span>
                )}
              </div>
              <input
                type="file"
                id="solution-pdf"
                accept=".pdf"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setPdfFileName(e.target.files[0].name);
                  }
                }}
                className="hidden"
              />
              <label
                htmlFor="solution-pdf"
                className="inline-block mt-2 text-[11px] text-[var(--accent)] font-semibold underline cursor-pointer"
              >
                Change Document
              </label>
            </div>

            <div className="pt-4 border-t border-[var(--line)] flex items-center justify-between">
              <span className="text-[11px] font-mono-data text-[var(--ink-muted)]">
                DPIIT GFR 149 Eligibility Verified
              </span>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? "Processing Submission..." : "Submit Technical Proposal"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
