"use client";

import React, { useState, useEffect } from "react";
import {
  Share2,
  CheckCircle2,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { ReplicationRequest, ScaleSolution } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ReplicationModal } from "@/components/domain/ReplicationModal";

export default function GovernmentScaleRepositoryPage() {
  const [solutions, setSolutions] = useState<ScaleSolution[]>([]);
  const [replications, setReplications] = useState<ReplicationRequest[]>([]);
  const [selectedForReplication, setSelectedForReplication] = useState<ScaleSolution | null>(null);
  const [successToast, setSuccessToast] = useState(false);

  const loadData = () => {
    Promise.all([api.getScaleSolutions(), api.getReplications()]).then(
      ([solData, repData]) => {
        setSolutions(solData);
        setReplications([...repData]);
      }
    );
  };

  useEffect(() => {
    loadData();
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("All");
  const [minScore, setMinScore] = useState(0);

  const domains = ["All", "Agriculture", "Defense", "Forestry", "Healthcare", "GovTech"];

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
        subtitle="Discover and directly replicate field-proven startup innovations validated by other sovereign ministries under GFR Rule 149 & Rule 194."
        badge={<Badge variant="highlight">HERO SCREEN 4: SCALE REPOSITORY</Badge>}
      />

      {successToast && (
        <div className="p-4 bg-[var(--positive-soft)] border border-[var(--positive)]/40 rounded-[8px] flex items-center gap-3 text-xs text-[var(--positive)] font-mono-data">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Inter-departmental adoption requisition recorded in sovereign scale register!</span>
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
                      SCALE CERTIFIED
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
                    Audit Score: {item.performanceScore}/100
                  </span>
                  <div className="text-[11px] font-mono-data text-[var(--ink-muted)]">
                    Active Deployed: {item.deployedUnits} Systems
                  </div>
                </div>
              </div>

              <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
                {item.summary}
              </p>

              <div className="p-3 bg-[var(--surface)] border border-[var(--line)] rounded-[6px] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-mono-data text-[var(--ink-muted)] block">
                    Originating Sovereign Validation:
                  </span>
                  <strong className="text-[var(--ink)]">{item.originatingDepartment}</strong>
                </div>

                <div className="sm:text-right font-mono-data text-[11px]">
                  <span className="text-[var(--ink-muted)] block">Estimated Cost:</span>
                  <strong className="text-[var(--accent)]">{item.budgetPerUnit} per unit</strong>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--line)] text-xs">
                <span className="text-[11px] font-mono-data text-[var(--ink-muted)]">
                  Statutory Rule: {item.gfrExemptionClause}
                </span>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setSelectedForReplication(item)}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Request Inter-Department Replication →</span>
                </Button>
              </div>
            </div>
          ))}

          {filteredSolutions.length === 0 && (
            <div className="p-12 text-center bg-[var(--surface)] border border-[var(--line)] rounded-[8px] text-xs text-[var(--ink-muted)]">
              No scale-certified solutions match your search or filter parameters.
            </div>
          )}
        </div>
      </div>

      {/* Active Inter-Department Replication Requisitions */}
      <div className="space-y-4 pt-4 border-t border-[var(--line)]">
        <h2 className="text-base font-bold text-[var(--ink)] font-editorial">
          Department Replication Registry (Audit Log)
        </h2>

        <div className="overflow-x-auto border border-[var(--line)] rounded-[8px] bg-[var(--surface-raised)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-subtle)] border-b border-[var(--line)] text-[var(--ink-muted)] font-mono-data uppercase text-[10px]">
              <tr>
                <th className="p-3">Adoption Requisition</th>
                <th className="p-3">Requesting Department</th>
                <th className="p-3">Target Location</th>
                <th className="p-3">Quantity</th>
                <th className="p-3">Status</th>
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
                    <Badge variant={rep.status === "in_pilot" ? "positive" : "warning"}>
                      {rep.status.toUpperCase()}
                    </Badge>
                  </td>
                </tr>
              ))}
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
