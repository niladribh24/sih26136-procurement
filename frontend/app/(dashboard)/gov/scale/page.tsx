"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import { Share2, CheckCircle2, ShieldCheck, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { getSession, subscribeSession } from "@/lib/auth";
import { errorMessage } from "@/lib/http";
import { ReplicationRequest, ScaleSolution } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ReplicationModal } from "@/components/domain/ReplicationModal";

const getServerSnapshot = () => null;

const STATUS_BADGE = { pending: "warning", approved: "info", in_pilot: "positive" } as const;
const STATUS_LABEL = { pending: "PENDING", approved: "APPROVED", in_pilot: "IN PILOT" } as const;

export default function GovernmentScaleRepositoryPage() {
  const [solutions, setSolutions] = useState<ScaleSolution[]>([]);
  const [replications, setReplications] = useState<ReplicationRequest[]>([]);
  const [selectedForReplication, setSelectedForReplication] = useState<ScaleSolution | null>(null);
  const [successToast, setSuccessToast] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const session = useSyncExternalStore(subscribeSession, getSession, getServerSnapshot);
  const isOfficer = session?.role === "govt_officer";

  const loadData = () => {
    Promise.all([api.getScaleSolutions(), api.getReplications()])
      .then(([solData, repData]) => {
        setSolutions(solData);
        setReplications([...repData]);
      })
      .catch((err: unknown) => setLoadError(errorMessage(err, "Could not load proven solutions.")));
  };

  // pending -> approved (the originating officer), approved -> in_pilot (the requesting officer).
  // The backend decides who may do which; its message is shown if this user may not.
  const advance = async (rep: ReplicationRequest) => {
    const next = rep.status === "pending" ? "approved" : "in_pilot";
    setActionError("");
    setBusyId(rep.id);
    try {
      const updated = await api.updateReplicationStatus(rep.id, next);
      setReplications((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (next === "in_pilot") loadData(); // deployments count changed
    } catch (err) {
      setActionError(errorMessage(err, "Could not update the replication request."));
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("All");
  const [minScore, setMinScore] = useState(0);

  // Problem["domain"] values: a proven solution's domain is its problem's.
  const domains = ["All", "AgriTech", "CleanTech", "Defence", "DroneTech", "GovTech", "HealthTech"];

  const filteredSolutions = solutions.filter((item) => {
    const matchesSearch =
      searchTerm === "" ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.startupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.domain && item.domain.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesDomain =
      selectedDomain === "All" ||
      (item.domain && item.domain.toLowerCase() === selectedDomain.toLowerCase());

    const matchesScore = item.performanceScore >= minScore;

    return matchesSearch && matchesDomain && matchesScore;
  });

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        code="STAGE-4-SCALE"
        title="Inter-Departmental Innovation Repository"
        subtitle="Discover and directly replicate field-proven innovations validated across central and state ministries under GFR Rule 149 & Rule 194."
        badge={<Badge variant="highlight">Stage 4: National Scale</Badge>}
      />

      {successToast && (
        <div className="p-4 bg-[var(--positive-soft)] border border-[var(--positive)]/40 rounded-[8px] flex items-center gap-3 text-xs text-[var(--positive)] font-mono-data">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Replication request recorded. The originating department can now approve it.</span>
        </div>
      )}

      {loadError && (
        <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-[6px] text-xs text-[var(--danger)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <input
              type="text"
              placeholder="Search by keyword, startup name, technology, or sector..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[var(--surface)] border border-[var(--line)] rounded-[6px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)] font-sans"
            />
          </div>
          <div>
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-[var(--surface)] border border-[var(--line)] rounded-[6px] text-[var(--ink)] font-mono-data focus:outline-none focus:border-[var(--accent)]"
            >
              <option value={0}>All Benchmark Scores</option>
              <option value={85}>Score &ge; 85 / 100</option>
              <option value={90}>Score &ge; 90 / 100 (Excellence)</option>
              <option value={95}>Score &ge; 95 / 100 (Gold Class)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-mono-data uppercase text-[var(--ink-muted)] mr-1">
            Sector Filter:
          </span>
          {domains.map((dom) => (
            <button
              key={dom}
              type="button"
              onClick={() => setSelectedDomain(dom)}
              className={`px-2.5 py-1 rounded-[4px] text-xs font-mono-data cursor-pointer transition-colors ${
                selectedDomain === dom
                  ? "bg-[var(--accent)] text-white font-semibold"
                  : "bg-[var(--surface)] text-[var(--ink-secondary)] border border-[var(--line)] hover:border-[var(--line-strong)]"
              }`}
            >
              {dom}
            </button>
          ))}
        </div>
      </div>

      {/* Solutions Available for Replication */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--ink)] font-editorial">
            Verified Field-Proven Innovations Available for Replication
          </h2>
          <span className="text-xs font-mono-data text-[var(--ink-muted)]">
            Showing {filteredSolutions.length} of {solutions.length} Solutions
          </span>
        </div>

        <div className="space-y-4">
          {filteredSolutions.map((item) => (
            <div
              key={item.id}
              className="p-6 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] space-y-4 shadow-2xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono-data text-[var(--accent)] font-semibold">
                      {item.pilotCode}
                    </span>
                    <Badge variant="positive">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      PROCURED · PROVEN
                    </Badge>
                    {item.domain && (
                      <span className="px-2 py-0.5 rounded bg-[var(--surface-subtle)] border border-[var(--line)] text-[10px] font-mono-data text-[var(--ink-muted)]">
                        {item.domain}
                      </span>
                    )}
                    <span className="text-xs font-mono-data text-[var(--ink-muted)]">
                      Vendor: {item.startupName} ({item.dpiitNumber})
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[var(--ink)] font-editorial">
                    {item.title}
                  </h3>
                </div>

                <div className="text-right">
                  <span className="text-sm font-bold font-mono-data text-[var(--positive)]">
                    Performance Score: {item.performanceScore}/100
                  </span>
                  <div className="text-[11px] font-mono-data text-[var(--ink-muted)]">
                    Deployments: {item.deployedUnits}
                  </div>
                </div>
              </div>

              <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
                {item.summary}
              </p>

              <div className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-[6px] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-mono-data text-[var(--ink-muted)] block">
                    Originating Department (validated {item.validationDate}):
                  </span>
                  <strong className="text-[var(--ink)]">{item.originatingDepartment}</strong>
                </div>

                <div className="sm:text-right font-mono-data text-[11px]">
                  <span className="text-[var(--ink-muted)] block">Pilot Budget:</span>
                  <strong className="text-[var(--accent)]">{item.budgetPerUnit} per deployment</strong>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--line)] text-xs">
                <span className="text-[11px] font-mono-data text-[var(--ink-muted)]">
                  Statutory Rule: {item.gfrExemptionClause}
                </span>

                {isOfficer && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setSelectedForReplication(item)}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Request Inter-Department Replication →</span>
                  </Button>
                )}
              </div>
            </div>
          ))}

          {filteredSolutions.length === 0 && (
            <div className="p-12 text-center bg-[var(--surface)] border border-[var(--line)] rounded-[8px] text-xs text-[var(--ink-muted)]">
              {solutions.length === 0
                ? "No proven solutions yet. A pilot becomes one when its procurement is recorded."
                : "No proven solutions match your search or filter parameters."}
            </div>
          )}
        </div>
      </div>

      {/* Active Inter-Department Replication Requisitions */}
      <div className="space-y-4 pt-4 border-t border-[var(--line)]">
        <h2 className="text-base font-bold text-[var(--ink)] font-editorial">
          Department Replication Registry
        </h2>

        {actionError && (
          <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-[6px] text-xs text-[var(--danger)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        <div className="overflow-x-auto border border-[var(--line)] rounded-[8px] bg-[var(--surface-raised)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-subtle)] border-b border-[var(--line)] text-[var(--ink-muted)] font-mono-data uppercase text-[10px]">
              <tr>
                <th className="p-3">Adoption Requisition</th>
                <th className="p-3">Requesting Department</th>
                <th className="p-3">Target Location</th>
                <th className="p-3">Quantity</th>
                <th className="p-3">Status</th>
                {isOfficer && <th className="p-3">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {replications.map((rep) => (
                <tr key={rep.id} className="hover:bg-[var(--surface)]">
                  <td className="p-3">
                    <div className="font-semibold text-[var(--ink)]">{rep.solutionTitle}</div>
                    <div className="text-[10px] font-mono-data text-[var(--ink-muted)]">
                      Vendor: {rep.startupName}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="text-[var(--ink)]">{rep.requestingDepartment}</div>
                    <div className="text-[10px] text-[var(--ink-muted)] font-mono-data">
                      {rep.requestingOfficerName}
                    </div>
                  </td>
                  <td className="p-3 font-mono-data">{rep.targetDeploymentSite}</td>
                  <td className="p-3 font-mono-data font-semibold">{rep.targetQuantity} units</td>
                  <td className="p-3">
                    <Badge variant={STATUS_BADGE[rep.status]}>{STATUS_LABEL[rep.status]}</Badge>
                  </td>
                  {isOfficer && (
                    <td className="p-3">
                      {rep.status !== "in_pilot" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busyId === rep.id}
                          onClick={() => advance(rep)}
                          title={
                            rep.status === "pending"
                              ? "For the officer who ran the original pilot"
                              : "For the officer who made this request"
                          }
                        >
                          {rep.status === "pending" ? "Approve" : "Mark in pilot"}
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {replications.length === 0 && (
                <tr>
                  <td colSpan={isOfficer ? 6 : 5} className="p-6 text-center text-[var(--ink-muted)]">
                    No replication requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {selectedForReplication && (
        <ReplicationModal
          isOpen={true}
          onClose={() => setSelectedForReplication(null)}
          scaleSolution={selectedForReplication}
          onSuccess={() => {
            setSuccessToast(true);
            loadData();
            setTimeout(() => setSuccessToast(false), 4000);
          }}
        />
      )}
    </div>
  );
}
