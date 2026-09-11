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
  GraduationCap,
} from "lucide-react";
import { DEMO_PERSONAS, setSession } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { SamarthEmblem } from "@/components/ui/SamarthEmblem";

export default function HomePage() {
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
            <SamarthEmblem size={32} />
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
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary" size="sm">
                Register Startup (DPIIT)
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 pt-12 pb-12 text-center">
        <SamarthEmblem size={64} className="mx-auto mb-5 shadow-xs hover:scale-105 transition-transform" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-raised)] border border-[var(--line)] text-xs text-[var(--ink-secondary)] mb-6 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-[var(--highlight)]" />
          <span>Smart India Hackathon 2026 · Problem SIH26136</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[var(--ink)] font-editorial leading-tight sm:leading-snug mb-6">
          Bridging Startup Innovation with Public Procurement
        </h1>

        <p className="text-base sm:text-lg text-[var(--ink-secondary)] max-w-2xl mx-auto leading-relaxed mb-8">
          A compliant, tamper-proof four-stage lifecycle transitioning DPIIT-recognized
          startups from competitive problem statements to verified pilot trials, GFR 194
          direct sanction orders, and national scale replication.
        </p>

        {/* 4-Stage Stepper Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto mb-10 text-left">
          <div className="p-3.5 rounded-[6px] bg-[var(--surface-raised)] border border-[var(--line)] shadow-2xs">
            <span className="text-[10px] font-mono-data font-bold text-[var(--accent)]">
              STAGE 01
            </span>
            <h2 className="text-sm font-bold text-[var(--ink)] mt-0.5">IDENTIFY</h2>
            <p className="text-[11px] text-[var(--ink-muted)] mt-1">
              Govt challenges published with target KPIs & automated fit matching.
            </p>
          </div>

          <div className="p-3.5 rounded-[6px] bg-[var(--surface-raised)] border border-[var(--line)] shadow-2xs">
            <span className="text-[10px] font-mono-data font-bold text-[var(--highlight)]">
              STAGE 02
            </span>
            <h2 className="text-sm font-bold text-[var(--ink)] mt-0.5">PILOT</h2>
            <p className="text-[11px] text-[var(--ink-muted)] mt-1">
              Field sandbox execution with independent evaluator verification.
            </p>
          </div>

          <div className="p-3.5 rounded-[6px] bg-[var(--surface-raised)] border border-[var(--line)] shadow-2xs">
            <span className="text-[10px] font-mono-data font-bold text-[var(--positive)]">
              STAGE 03
            </span>
            <h2 className="text-sm font-bold text-[var(--ink)] mt-0.5">PROCURE</h2>
            <p className="text-[11px] text-[var(--ink-muted)] mt-1">
              Direct sanction order generated under GFR 194 Startup Single Source Exemption.
            </p>
          </div>

          <div className="p-3.5 rounded-[6px] bg-[var(--surface-raised)] border border-[var(--line)] shadow-2xs">
            <span className="text-[10px] font-mono-data font-bold text-[#6D28D9]">
              STAGE 04
            </span>
            <h2 className="text-sm font-bold text-[var(--ink)] mt-0.5">SCALE</h2>
            <p className="text-[11px] text-[var(--ink-muted)] mt-1">
              National Verified Solutions Catalog for multi-department replication.
            </p>
          </div>
        </div>
      </section>

      {/* Evaluator / Judge Quick Launchpad */}
      <section className="max-w-5xl mx-auto px-6 py-8 w-full">
        <div className="p-6 rounded-[10px] bg-[var(--surface)] border border-[var(--line-strong)] shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--line)] mb-6">
            <div>
              <h2 className="text-lg font-bold text-[var(--ink)] font-editorial">
                Judge & Evaluator Quick Launchpad
              </h2>
              <p className="text-xs text-[var(--ink-muted)]">
                Instant 1-click evaluation access with pre-seeded database personas (Strict Edge RBAC enabled).
              </p>
            </div>
            <span className="text-[11px] font-mono-data px-2 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent)] font-semibold">
              Zero Manual Setup
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Persona 1: Government Department Officer */}
            <div className="p-5 rounded-[8px] bg-[var(--surface-raised)] border border-[var(--line)] hover:border-[var(--accent)] transition-all flex flex-col justify-between group">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[var(--accent)]" />
                  <span className="text-xs font-mono-data font-semibold text-[var(--accent)] uppercase">
                    Government Officer
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
                    <span>Review Ranked Shortlists (#PRB-2026-081)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span>Sanction Pilot Milestones & Tranches</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span>Issue GFR 194 Direct Sanction Orders</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[var(--line)]">
                <Button
                  variant="primary"
                  className="w-full justify-between"
                  onClick={() => handleLaunchPersona("user-govt-01")}
                >
                  <span>Launch Govt Portal</span>
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
                    Startup Bidder
                  </span>
                </div>
                <h3 className="text-base font-bold text-[var(--ink)]">
                  Vikram Mehta
                </h3>
                <p className="text-xs text-[var(--ink-secondary)]">
                  Founder & CEO, AeroKisan Technologies (DPIIT Verified: DIPP98234)
                </p>
                <div className="text-[11px] text-[var(--ink-muted)] pt-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span>Technical Capability Tag Extraction</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span>Submit Proposals to Open Challenges</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span>Upload Deliverables & Track Tranches</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[var(--line)]">
                <Button
                  variant="highlight"
                  className="w-full justify-between"
                  onClick={() => handleLaunchPersona("user-startup-01")}
                >
                  <span>Launch Startup Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Persona 3: Independent Technical Evaluator */}
            <div className="p-5 rounded-[8px] bg-[var(--surface-raised)] border border-[var(--line)] hover:border-[#6D28D9] transition-all flex flex-col justify-between group">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#6D28D9]" />
                  <span className="text-xs font-mono-data font-semibold text-[#6D28D9] uppercase">
                    Technical Evaluator
                  </span>
                </div>
                <h3 className="text-base font-bold text-[var(--ink)]">
                  Prof. K. Rao
                </h3>
                <p className="text-xs text-[var(--ink-secondary)]">
                  Professor of Autonomous Robotics, Indian Institute of Technology Delhi
                </p>
                <div className="text-[11px] text-[var(--ink-muted)] pt-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span>Independent Lab & Field Validation</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span>Audit KPI Telemetry & Milestone Proofs</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--positive)]" />
                    <span>Execute Pass/Fail Governance Sign-Offs</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[var(--line)]">
                <Button
                  variant="secondary"
                  className="w-full justify-between hover:bg-[#6D28D9]/10 hover:border-[#6D28D9]"
                  onClick={() => handleLaunchPersona("user-eval-01")}
                >
                  <span>Launch Evaluator Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[var(--line)] py-6 text-center text-xs text-[var(--ink-muted)] bg-[var(--surface)]">
        <SamarthEmblem size={24} className="mx-auto mb-2 opacity-75" />
        <p>
          SAMARTH Platform · SIH 2026 Problem SIH26136 · Compliant with General Financial Rules (GFR Rule 194) & DPIIT Startup Framework
        </p>
        <p className="mt-1 text-[11px] font-mono-data text-[var(--ink-muted)]">
          Designed for Central & State Ministries, Nodal Evaluators, and Registered DPIIT Startups
        </p>
      </footer>
    </div>
  );
}
