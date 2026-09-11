"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  FileUp,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { StartupTagList } from "@/components/domain/StartupTagList";

export default function StartupProfilePage() {
  const [startupName, setStartupName] = useState("AeroKisan Technologies Pvt Ltd");
  const [dpiitNumber, setDpiitNumber] = useState("DIPP98234");
  const [turnoverBand, setTurnoverBand] = useState("₹1Cr–₹5Cr");
  const [location, setLocation] = useState("Bengaluru, Karnataka");
  const [incorporationYear, setIncorporationYear] = useState("2022");
  const [description, setDescription] = useState(
    "DeepTech drone manufacturing company specializing in multispectral canopy-penetrating optical payloads and edge-inference autonomous navigation systems."
  );

  const [tags, setTags] = useState<string[]>([
    "Computer Vision",
    "Multispectral Imaging",
    "SWIR Sensors",
    "Edge Compute",
    "Autonomous Flight",
    "Encrypted Mesh Telemetry",
  ]);

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedSummary, setExtractedSummary] = useState<string | null>(
    "Extracted from AeroKisan_R&D_Dossier_2025.pdf: Core expertise in SWIR optical telemetry and edge tensor computing."
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (session) {
      if (session.orgName) setStartupName(session.orgName);
      if (session.dpiitNumber) setDpiitNumber(session.dpiitNumber);
    }
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setExtractedSummary(null);

    try {
      const res = await api.extractDocumentTags(file.name);
      setTags(res.tags);
      setExtractedSummary(res.summary);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        code="STARTUP-PROFILE"
        title="DPIIT Profile & Technical Competencies"
        subtitle="Maintain official startup credentials and upload project whitepapers for automated capability extraction."
        badge={
          <Badge variant="dpiit_verified">
            <ShieldCheck className="w-3 h-3 mr-1" />
            DPIIT VERIFIED · {dpiitNumber}
          </Badge>
        }
      />

      {savedSuccess && (
        <div className="p-3 bg-[var(--positive-soft)] border border-[var(--positive)]/30 rounded-[6px] text-xs text-[var(--positive)] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Profile and technical competencies successfully saved.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Core Credentials Card */}
        <div className="p-6 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-4 shadow-2xs">
          <h2 className="text-base font-bold text-[var(--ink)] font-editorial flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[var(--accent)]" />
            <span>Entity Particulars</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Registered Legal Name"
              value={startupName}
              onChange={(e) => setStartupName(e.target.value)}
              required
            />

            <Input
              label="DPIIT Recognition Number"
              value={dpiitNumber}
              onChange={(e) => setDpiitNumber(e.target.value)}
              helperText="Enables automatic GFR Rule 149 exemption from prior turnover"
              required
            />

            <Select
              label="Annual Turnover Band"
              value={turnoverBand}
              onChange={(e) => setTurnoverBand(e.target.value)}
              options={[
                { value: "< ₹1Cr", label: "Under ₹1 Crore (Micro-Startup)" },
                { value: "₹1Cr–₹5Cr", label: "₹1 Crore – ₹5 Crore" },
                { value: "₹5Cr–₹25Cr", label: "₹5 Crore – ₹25 Crore" },
                { value: "> ₹25Cr", label: "Exceeds ₹25 Crore (Graduated)" },
              ]}
              helperText="Startup eligibility is capped at ₹25 Cr turnover under DPIIT rules"
            />

            <Input
              label="Registered Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--ink-secondary)] uppercase tracking-wider block mb-1.5">
              Technical Mission Summary
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--surface-raised)] border border-[var(--line)] rounded-[6px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Capability Extraction Dossier */}
        <div className="p-6 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-5 shadow-2xs">
          <div>
            <h2 className="text-base font-bold text-[var(--ink)] font-editorial flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--highlight)]" />
              <span>AI Capability Tag Extractor (Stage 1: Identify)</span>
            </h2>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              Upload past technical project reports, patents, or whitepapers. The NLP pipeline
              extracts verified skills used for automated problem matching.
            </p>
          </div>

          {/* Upload Dropzone */}
          <div className="border-2 border-dashed border-[var(--line-strong)] hover:border-[var(--accent)] rounded-[8px] p-6 text-center transition-colors bg-[var(--surface)]">
            <input
              type="file"
              id="project-pdf-upload"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="project-pdf-upload"
              className="flex flex-col items-center justify-center cursor-pointer gap-2"
            >
              <FileUp className="w-8 h-8 text-[var(--ink-muted)]" />
              <div className="text-xs font-medium text-[var(--ink)]">
                {isExtracting ? (
                  <span className="text-[var(--highlight)] flex items-center gap-1.5 font-mono-data">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    Extracting skills via NLP pipeline...
                  </span>
                ) : (
                  <span>
                    Drop past project PDF here, or <strong className="text-[var(--accent)] underline">browse files</strong>
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[var(--ink-muted)]">
                Supported: PDF dossiers up to 25MB
              </span>
            </label>
          </div>

          {extractedSummary && (
            <div className="p-3 bg-[var(--surface-subtle)] border border-[var(--line)] rounded-[6px] text-xs text-[var(--ink-secondary)]">
              <span className="font-semibold text-[var(--ink)]">NLP Synthesis: </span>
              {extractedSummary}
            </div>
          )}

          {/* Interactive Tag Editor */}
          <StartupTagList tags={tags} onChange={setTags} />
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="md">
            Save Profile & Capabilities
          </Button>
        </div>
      </form>
    </div>
  );
}
