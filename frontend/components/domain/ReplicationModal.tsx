"use client";

import React, { useState } from "react";
import { Share2, CheckCircle2, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface ReplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  scaleSolution: any;
  onSuccess: () => void;
}

export const ReplicationModal: React.FC<ReplicationModalProps> = ({
  isOpen,
  onClose,
  scaleSolution,
  onSuccess,
}) => {
  const session = getSession();

  const [department, setDepartment] = useState(
    session?.department || "Forest Department, Govt of Tamil Nadu"
  );
  const [officerName, setOfficerName] = useState(session?.name || "Shri R. Annamalai (CCF)");
  const [officerEmail, setOfficerEmail] = useState(session?.email || "ccf.coimbatore@tn.gov.in");
  const [deploymentSite, setDeploymentSite] = useState("Coimbatore-Palakkad Railway Corridor");
  const [quantity, setQuantity] = useState("30");
  const [submitting, setSubmitting] = useState(false);

  if (!scaleSolution) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.createReplicationRequest({
        pilotId: scaleSolution.id,
        solutionTitle: scaleSolution.title,
        startupName: scaleSolution.startupName,
        originatingDepartment: scaleSolution.originatingDepartment,
        requestingDepartment: department,
        requestingOfficerName: officerName,
        requestingOfficerEmail: officerEmail,
        targetDeploymentSite: deploymentSite,
        targetQuantity: parseInt(quantity, 10) || 10,
      });

      onSuccess();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Inter-Department Innovation Replication Requisition"
      description={`Citing field validation by ${scaleSolution.originatingDepartment}`}
      maxWidthClass="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-[var(--surface-subtle)] border border-[var(--line)] rounded-[6px] text-xs space-y-1">
          <div className="font-bold text-[var(--ink)]">{scaleSolution.title}</div>
          <div className="text-[11px] text-[var(--ink-muted)] font-mono-data">
            Vendor: {scaleSolution.startupName} · Tested Rating: {scaleSolution.performanceScore}/100
          </div>
        </div>

        <Input
          label="Requesting Ministry / State Department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Authorized Nodal Officer"
            value={officerName}
            onChange={(e) => setOfficerName(e.target.value)}
            required
          />

          <Input
            label="Official Email"
            type="email"
            value={officerEmail}
            onChange={(e) => setOfficerEmail(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Target Deployment Location"
            value={deploymentSite}
            onChange={(e) => setDeploymentSite(e.target.value)}
            required
          />

          <Input
            label="Requisition Quantity (Units)"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>

        <div className="p-3 bg-[var(--positive-soft)] border border-[var(--positive)]/30 rounded-[6px] text-[11px] text-[var(--positive)]">
          <strong>Direct Requisition Clause: </strong>
          Adoption proceeds under GFR Rule 149 without re-conducting preliminary pilot trials, saving an estimated 4–6 months of administrative review.
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[var(--line)]">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Formal Replication Request"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
