"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Building2,
  Rocket,
  Scale,
  Award,
  ChevronRight,
} from "lucide-react";
import { DEMO_PERSONAS, setSession } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

export default function MarketingGatewayPage() {
  const router = useRouter();

  const handleLaunchPersona = (personaId: string) => {
    const persona = DEMO_PERSONAS.find((p) => p.id === personaId);
    if (!persona) return;
    setSession(persona);
    if (persona.role === "startup") {
      router.push("/startup/problems");
    } else {
      router.push("/gov/problems");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] flex flex-col selection:bg-[var(--accent-soft)]">
      {/* Top Banner */}
      <header className="w-full bg-[var(--surface-raised)] border-b border-[var(--line)] py-3 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[6px] bg-[var(--accent)] flex items-center justify-center text-white">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold tracking-wider text-base text-[var(--accent)] font-editorial">
                SAMARTH
              </span>
              <span className="ml-2 text-[10px] font-mono-data px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] text-[var(--ink-muted)] border border-[var(--line)]">
                SIH26136
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="secondary" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary" size="sm">
                Register Entity
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-raised)] border border-[var(--line)] text-xs font-mono-data text-[var(--ink-secondary)] shadow-2xs">
          <Award className="w-3.5 h-3.5 text-[var(--highlight)]" />
          <span>Smart India Hackathon 2026 · Problem SIH26136</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[var(--ink)] font-editorial max-w-3xl mx-auto leading-tight">
          Bridging Agile Startup Innovation with Sovereign Public Procurement
        </h1>

        <p className="text-base sm:text-lg text-[var(--ink-secondary)] max-w-2xl mx-auto font-light leading-relaxed">
          A verifiable four-stage pathway enabling government departments to discover,
          pilot, sanction, and scale field-tested technical innovations with zero friction.
        </p>

        {/* 4-Stage Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-6 max-w-3xl mx-auto text-left">
          <div className="p-4 rounded-[8px] bg-[var(--surface-raised)] border border-[var(--line)] shadow-2xs">
            <div className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--highlight)] font-semibold">
              Stage 1
            </div>
            <div className="text-sm font-bold text-[var(--ink)] font-editorial mt-0.5">
              IDENTIFY
            </div>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              NLP proposal extraction, semantic ranking & keyword overlap signals.
            </p>
          </div>

          <div className="p-4 rounded-[8px] bg-[var(--surface-raised)] border border-[var(--line)] shadow-2xs">
            <div className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--accent)] font-semibold">
              Stage 2
            </div>
            <div className="text-sm font-bold text-[var(--ink)] font-editorial mt-0.5">
              PILOT
            </div>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              Milestone state machine, KPI metrics, tranches & independent sign-offs.
            </p>
          </div>

          <div className="p-4 rounded-[8px] bg-[var(--surface-raised)] border border-[var(--line)] shadow-2xs">
            <div className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--positive)] font-semibold">
              Stage 3
            </div>
            <div className="text-sm font-bold text-[var(--ink)] font-editorial mt-0.5">
              PROCURE
            </div>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              GFR Rule 149 sanction dockets & automated GeM tender simulation.
            </p>
          </div>

          <div className="p-4 rounded-[8px] bg-[var(--surface-raised)] border border-[var(--line)] shadow-2xs">
            <div className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--info)] font-semibold">
              Stage 4
            </div>
            <div className="text-sm font-bold text-[var(--ink)] font-editorial mt-0.5">
              SCALE
            </div>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              Inter-departmental repository for 1-click cross-ministry replication.
            </p>
          </div>
        </div>
      </section>

      {/* Evaluator / Judge Quick Launchpad */}
      <section className="max-w-4xl mx-auto px-6 py-10 w-full">
        <div className="p-6 rounded-[10px] bg-[var(--surface)] border border-[var(--line-strong)] shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--line)] mb-6">
            <div>
              <h2 className="text-lg font-bold text-[var(--ink)] font-editorial">
                Judge & Evaluator Launchpad
              </h2>
              <p className="text-xs text-[var(--ink-muted)]">
                Instant 1-click evaluation access with pre-seeded database personas (True RBAC enabled).
              </p>
            </div>
            <span className="text-[11px] font-mono-data px-2 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent)] font-semibold">
              Zero Manual Setup
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Persona 1: Government Department Officer */}
            <div className="p-5 rounded-[8px] bg-[var(--surface-raised)] border border-[var(--line)] hover:border-[var(--accent)] transition-all flex flex-col justify-between group">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[var(--accent)]" />
                  <span className="text-xs font-mono-data font-semibold text-[var(--accent)] uppercase">
                    Government Officer Portal
                  </span>
                </div>
                <h3 className="text-base font-bold text-[var(--ink)]">
                  Dr. A. Sharma
                </h3>
                <p className="text-xs text-[var(--ink-secondary)]">
                  Nodal Director, Precision Agriculture & Drone Systems, ICAR
                </p>
                <div className="text-[11px] text-[var(--ink-muted)] pt-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span>Review Ranked Shortlist for Canopy Drone (#PRB-2026-081)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span>Monitor Pilot Milestones & Tranche Authorizations</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span>Generate Sovereign Sanction Docket for GeM</span>
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-[var(--line)]">
                <Button
                  variant="primary"
                  className="w-full justify-between"
                  onClick={() => handleLaunchPersona("user-govt-01")}
                >
                  <span>Launch as Government Officer</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Persona 2: Startup Founder */}
            <div className="p-5 rounded-[8px] bg-[var(--surface-raised)] border border-[var(--line)] hover:border-[var(--highlight)] transition-all flex flex-col justify-between group">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-[var(--highlight)]" />
                  <span className="text-xs font-mono-data font-semibold text-[var(--highlight)] uppercase">
                    Startup Bidder Portal
                  </span>
                </div>
                <h3 className="text-base font-bold text-[var(--ink)]">
                  Vikram Mehta
                </h3>
                <p className="text-xs text-[var(--ink-secondary)]">
                  Founder & CEO, AeroKisan Technologies Pvt Ltd (DPIIT Verified)
                </p>
                <div className="text-[11px] text-[var(--ink-muted)] pt-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span>AI Capability Tag Extraction from Past Project PDFs</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span>Submit Technical Proposal to Border Drone RFP</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span>Upload Milestone Deliverables & Log Achieved KPIs</span>
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-[var(--line)]">
                <Button
                  variant="highlight"
                  className="w-full justify-between"
                  onClick={() => handleLaunchPersona("user-startup-01")}
                >
                  <span>Launch as Startup Founder</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[var(--line)] py-6 text-center text-xs text-[var(--ink-muted)] bg-[var(--surface)]">
        <p>
          SAMARTH Platform · SIH 2026 Problem SIH26136 · Compliant with General Financial Rules (GFR 149) & DPIIT Startup Framework
        </p>
      </footer>
    </div>
  );
}
