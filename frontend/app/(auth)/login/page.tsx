"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Building2, Rocket, AlertCircle, Sparkles } from "lucide-react";
import { DEMO_PERSONAS, setSession } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect");
  const authError = searchParams.get("error");

  const [selectedRole, setSelectedRole] = useState<"startup" | "govt_officer">("govt_officer");
  const [email, setEmail] = useState("sharma.icar@gov.in");
  const [password, setPassword] = useState("••••••••••••");
  const [errorMsg, setErrorMsg] = useState("");

  const handleRoleTabChange = (role: "startup" | "govt_officer") => {
    setSelectedRole(role);
    if (role === "startup") {
      setEmail("vikram@aerokisan.tech");
    } else {
      setEmail("sharma.icar@gov.in");
    }
  };

  const handleAutofillPersona = (personaId: string) => {
    const persona = DEMO_PERSONAS.find((p) => p.id === personaId);
    if (!persona) return;
    setSelectedRole(persona.role === "startup" ? "startup" : "govt_officer");
    setEmail(persona.email);
    setPassword("samarth-demo-2026");
    handleSubmit(persona);
  };

  const handleSubmit = (overridePersona?: UserSession) => {
    const targetPersona =
      overridePersona ||
      DEMO_PERSONAS.find((p) => p.email.toLowerCase() === email.toLowerCase()) ||
      DEMO_PERSONAS.find((p) => p.role === selectedRole);

    if (!targetPersona) {
      setErrorMsg("No account found matching credentials.");
      return;
    }

    setSession(targetPersona);

    if (redirectPath) {
      router.push(redirectPath);
    } else if (targetPersona.role === "startup") {
      router.push("/startup/problems");
    } else {
      router.push("/gov/problems");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--ink)] font-editorial">
          Sign in to SAMARTH
        </h2>
        <p className="text-xs text-[var(--ink-muted)] mt-1">
          Access your sovereign procurement workspace
        </p>
      </div>

      {authError && (
        <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-[6px] text-xs text-[var(--danger)] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {authError === "startup_role_required"
              ? "Access denied: The requested page requires a verified Startup account."
              : "Access denied: The requested page requires an authorized Government Officer account."}
          </span>
        </div>
      )}

      {/* Role Selection Tabs */}
      <div className="grid grid-cols-2 p-1 bg-[var(--surface)] border border-[var(--line)] rounded-[6px]">
        <button
          type="button"
          onClick={() => handleRoleTabChange("govt_officer")}
          className={`py-1.5 text-xs font-medium rounded-[4px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
            selectedRole === "govt_officer"
              ? "bg-[var(--accent)] text-white font-semibold shadow-xs"
              : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Government Officer</span>
        </button>

        <button
          type="button"
          onClick={() => handleRoleTabChange("startup")}
          className={`py-1.5 text-xs font-medium rounded-[4px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
            selectedRole === "startup"
              ? "bg-[var(--accent)] text-white font-semibold shadow-xs"
              : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
          }`}
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>Startup Bidder</span>
        </button>
      </div>

      {/* Login Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-4"
      >
        <Input
          label="Official Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {errorMsg && <div className="text-xs text-[var(--danger)]">{errorMsg}</div>}

        <Button type="submit" variant="primary" className="w-full">
          Sign In
        </Button>
      </form>

      {/* Quick Autofill Demo Section */}
      <div className="pt-4 border-t border-[var(--line)]">
        <div className="flex items-center gap-1.5 text-[11px] font-mono-data text-[var(--ink-muted)] mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--highlight)]" />
          <span>Evaluation Demo Personas (1-Click Login):</span>
        </div>

        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => handleAutofillPersona("user-govt-01")}
            className="w-full text-left p-2 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] text-xs flex items-center justify-between transition-colors cursor-pointer"
          >
            <div>
              <div className="font-semibold text-[var(--ink)]">Dr. A. Sharma</div>
              <div className="text-[10px] text-[var(--ink-muted)]">ICAR Government Officer</div>
            </div>
            <span className="text-[10px] font-mono-data text-[var(--accent)] font-semibold">
              Enter Portal →
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleAutofillPersona("user-startup-01")}
            className="w-full text-left p-2 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] text-xs flex items-center justify-between transition-colors cursor-pointer"
          >
            <div>
              <div className="font-semibold text-[var(--ink)]">Vikram Mehta</div>
              <div className="text-[10px] text-[var(--ink-muted)]">AeroKisan Tech (DPIIT Verified)</div>
            </div>
            <span className="text-[10px] font-mono-data text-[var(--highlight)] font-semibold">
              Enter Portal →
            </span>
          </button>
        </div>
      </div>

      <div className="text-center text-xs text-[var(--ink-muted)]">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-[var(--accent)] font-medium hover:underline">
          Register new entity
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-xs text-[var(--ink-muted)]">Loading credentials...</div>}>
      <LoginForm />
    </Suspense>
  );
}
