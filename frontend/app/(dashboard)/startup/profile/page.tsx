"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  FileUp,
  FileText,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { getSession, setSession } from "@/lib/auth";
import { api } from "@/lib/api";
import { ApiError, errorMessage } from "@/lib/http";
import { StartupDocument, StartupProfile, TurnoverBand } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { StartupTagList } from "@/components/domain/StartupTagList";

function uploadErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 413) return "File is larger than the 10 MB limit.";
  if (err instanceof ApiError && err.status === 415) return "Only PDF files can be uploaded.";
  return errorMessage(err, "Upload failed. Please retry.");
}

export default function StartupProfilePage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [startupName, setStartupName] = useState("");
  const [dpiitNumber, setDpiitNumber] = useState("");
  const [dpiitVerified, setDpiitVerified] = useState(false);
  const [turnoverBand, setTurnoverBand] = useState<TurnoverBand>("< ₹1Cr");
  const [location, setLocation] = useState("");
  const [incorporationYear, setIncorporationYear] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [documents, setDocuments] = useState<StartupDocument[]>([]);

  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [extractedSummary, setExtractedSummary] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);

  const applyProfile = (p: StartupProfile) => {
    setStartupName(p.startupName);
    setDpiitNumber(p.dpiitNumber);
    setDpiitVerified(p.dpiitVerified);
    if (p.turnoverBand) setTurnoverBand(p.turnoverBand);
    setLocation(p.location ?? "");
    setIncorporationYear(p.incorporationYear != null ? String(p.incorporationYear) : "");
    setDescription(p.description ?? "");
    setTags(p.tags);
    setDocuments(p.documents);
  };

  // Load after mount (client-only data) to avoid an SSR hydration mismatch
  useEffect(() => {
    api
      .getMyProfile()
      .then(applyProfile)
      .catch((err: unknown) => setLoadError(errorMessage(err, "Could not load your profile.")))
      .finally(() => setLoading(false));
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setUploadError("");
    setExtractedSummary(null);

    try {
      const res = await api.extractDocumentTags(file);
      if (res.extractionStatus === "pending") {
        setExtractedSummary(
          `${res.fileName} uploaded. Capability extraction is pending (the analysis service is offline) and will be filled in automatically later.`
        );
      } else {
        setExtractedSummary(res.summary);
      }
      // Tags are the union across all documents, so re-read the profile rather than using res.tags alone.
      applyProfile(await api.getMyProfile());
    } catch (err) {
      setUploadError(uploadErrorMessage(err));
    } finally {
      setIsExtracting(false);
      e.target.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaveError("");

    const year = incorporationYear.trim() ? parseInt(incorporationYear, 10) : null;
    if (year !== null && isNaN(year)) {
      setSaveError("Year of incorporation must be a number.");
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateMyProfile({
        startupName: startupName.trim(),
        dpiitNumber: dpiitNumber.trim().toUpperCase(),
        turnoverBand,
        location: location.trim() || null,
        incorporationYear: year,
        description: description.trim() || null,
      });
      applyProfile(updated);

      // The startup name is the session's orgName, so keep the header in sync.
      const session = getSession();
      if (session) {
        setSession({ ...session, orgName: updated.startupName, dpiitNumber: updated.dpiitNumber });
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setSaveError(errorMessage(err, "Could not save your profile. Please retry."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-[var(--ink-muted)] flex items-center justify-center gap-2">
        <Clock className="w-4 h-4 animate-spin" />
        <span>Loading startup profile...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-[6px] text-xs text-[var(--danger)] flex items-center gap-2 max-w-4xl">
        <AlertCircle className="w-4 h-4" />
        <span>{loadError}</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        code="STARTUP-PROFILE"
        title="DPIIT Profile & Technical Competencies"
        subtitle="Maintain official startup credentials and upload project whitepapers for automated capability extraction."
        badge={
          dpiitVerified ? (
            <Badge variant="dpiit_verified">
              <ShieldCheck className="w-3 h-3 mr-1" />
              DPIIT VERIFIED · {dpiitNumber}
            </Badge>
          ) : (
            <Badge variant="warning">
              <AlertTriangle className="w-3 h-3 mr-1" />
              DPIIT VERIFICATION PENDING · {dpiitNumber}
            </Badge>
          )
        }
      />

      {savedSuccess && (
        <div className="p-3 bg-[var(--positive-soft)] border border-[var(--positive)]/30 rounded-[6px] text-xs text-[var(--positive)] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Profile and technical competencies successfully saved.</span>
        </div>
      )}

      {saveError && (
        <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-[6px] text-xs text-[var(--danger)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{saveError}</span>
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
              helperText="Enables automatic GFR Rule 194 exemption from prior turnover"
              required
            />

            <Select
              label="Annual Turnover Band"
              value={turnoverBand}
              onChange={(e) => setTurnoverBand(e.target.value as TurnoverBand)}
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

            <Input
              label="Year of Incorporation"
              type="number"
              value={incorporationYear}
              onChange={(e) => setIncorporationYear(e.target.value)}
              helperText="Entities eligible under DPIIT within 10 years of incorporation"
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
              <span>Technical Capability Tag Extraction (Stage 1: Identify)</span>
            </h2>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              Upload past technical project reports, patents, or whitepapers. Automated document analysis
              extracts verified capabilities used for challenge matching.
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
                    Extracting capabilities & sector tags...
                  </span>
                ) : (
                  <span>
                    Drop past project PDF here, or <strong className="text-[var(--accent)] underline">browse files</strong>
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[var(--ink-muted)]">
                Supported: PDF dossiers up to 10MB
              </span>
            </label>
          </div>

          {uploadError && (
            <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-[6px] text-xs text-[var(--danger)] flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{uploadError}</span>
            </div>
          )}

          {documents.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono-data uppercase tracking-wider text-[var(--ink-muted)] font-semibold block">
                Uploaded Dossiers
              </span>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 p-2 bg-[var(--surface)] border border-[var(--line)] rounded-[6px] text-xs"
                >
                  <span className="flex items-center gap-1.5 text-[var(--ink)] min-w-0">
                    <FileText className="w-3.5 h-3.5 text-[var(--ink-muted)] shrink-0" />
                    <span className="truncate">{doc.fileName}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-mono-data text-[11px] text-[var(--ink-muted)]">{doc.uploadedAt}</span>
                    {doc.extractionStatus === "done" ? (
                      <Badge variant="positive">EXTRACTED</Badge>
                    ) : (
                      <Badge variant="warning">EXTRACTION PENDING</Badge>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {extractedSummary && (
            <div className="p-3 bg-[var(--surface-subtle)] border border-[var(--line)] rounded-[6px] text-xs text-[var(--ink-secondary)]">
              <span className="font-semibold text-[var(--ink)] font-mono-data uppercase text-[11px] block mb-1">
                Extracted Project Abstract:
              </span>
              {extractedSummary}
            </div>
          )}

          {/* Tags come from document extraction (union across all uploads); they aren't hand-edited */}
          <StartupTagList tags={tags} onChange={setTags} readOnly />
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="md" disabled={saving}>
            {saving ? "Saving..." : "Save Profile & Capabilities"}
          </Button>
        </div>
      </form>
    </div>
  );
}
