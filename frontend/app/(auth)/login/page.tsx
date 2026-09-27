"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Building2, Rocket, AlertCircle, Sparkles } from "lucide-react";
import { ACTIVE_PERSONAS } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { USE_MOCK_API } from "@/lib/config";
import { errorMessage } from "@/lib/http";
import { UserRole, UserSession } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function personaFor(role: UserRole): UserSession | undefined {
  return ACTIVE_PERSONAS.find((p) => p.role === role);
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect");
  const authError = searchParams.get("error");

  const [selectedRole, setSelectedRole] = useState<UserRole>("govt_officer");
  const [email, setEmail] = useState(personaFor("govt_officer")?.email ?? "");
  // The mock accepts any password; the real backend needs the actual one.
  const [password, setPassword] = useState(USE_MOCK_API ? "••••••••••••" : "");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSafeRedirect = (url: string | null): boolean =>
    Boolean(url && url.startsWith("/") && !url.startsWith("//") && !url.includes(":"));

  const isPathAllowedForRole = (path: string, role: string): boolean => {
    if (role === "startup") return path.startsWith("/startup");
    if (role === "govt_officer" || role === "evaluator" || role === "admin") return path.startsWith("/gov");
    return false;
  };

  const handleRoleTabChange = (role: UserRole) => {
    setSelectedRole(role);
    setEmail(personaFor(role)?.email ?? "");
  };

  const goToDashboard = (session: UserSession) => {
    if (redirectPath && isSafeRedirect(redirectPath) && isPathAllowedForRole(redirectPath, session.role)) {
      router.push(redirectPath);
    } else if (session.role === "startup") {
      router.push("/startup/problems");
    } else {
      router.push("/gov/problems");
    }
  };

  const runLogin = async (login: () => Promise<UserSession>) => {
    if (submitting) return;
    setErrorMsg("");
    setSubmitting(true);
    try {
      goToDashboard(await login());
    } catch (err) {
      setErrorMsg(errorMessage(err, "Sign-in failed. Please retry."));
      setSubmitting(false);
    }
  };

  const handleAutofillPersona = (persona: UserSession) => {
    setSelectedRole(persona.role);
    setEmail(persona.email);
    runLogin(() => authApi.loginAsPersona(persona));
  };

  const handleSubmit = () => {
    runLogin(() => authApi.login(email, password, selectedRole));
  };

  const getErrorMessage = (err: string | null) => {
    if (err === "session_expired") return "Your session has expired. Please sign in again.";
    if (err === "startup_role_required") return "Access denied: The requested page requires a verified Startup account.";
    if (err === "gov_role_required") return "Access denied: The requested page requires an authorized Government Officer / Evaluator account.";
    if (err) return "Authentication required: Please sign in to access this workspace.";
    return null;
  };

  const displayedAuthError = getErrorMessage(authError);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--ink)] font-editorial">
          Sign in to SAMARTH
        </h2>
        <p className="text-xs text-[var(--ink-muted)] mt-1">
          Access your public procurement portal and active workflows
        </p>
      </div>

      {displayedAuthError && (
        <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-[6px] text-xs text-[var(--danger)] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{displayedAuthError}</span>
        </div>
      )}

      {/* Role Selection Tabs */}
      <div className="grid grid-cols-3 p-1 bg-[var(--surface)] border border-[var(--line)] rounded-[6px] text-center">
        <button
          type="button"
          onClick={() => handleRoleTabChange("govt_officer")}
          className={`py-1.5 text-xs font-medium rounded-[4px] transition-colors flex items-center justify-center gap-1 cursor-pointer ${
            selectedRole === "govt_officer"
              ? "bg-[var(--accent)] text-white font-semibold shadow-xs"
              : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Govt Officer</span>
        </button>

        <button
          type="button"
          onClick={() => handleRoleTabChange("startup")}
          className={`py-1.5 text-xs font-medium rounded-[4px] transition-colors flex items-center justify-center gap-1 cursor-pointer ${
            selectedRole === "startup"
              ? "bg-[var(--accent)] text-white font-semibold shadow-xs"
              : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
          }`}
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>Startup</span>
        </button>

        <button
          type="button"
          onClick={() => handleRoleTabChange("evaluator")}
          className={`py-1.5 text-xs font-medium rounded-[4px] transition-colors flex items-center justify-center gap-1 cursor-pointer ${
            selectedRole === "evaluator"
              ? "bg-[var(--accent)] text-white font-semibold shadow-xs"
              : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
          }`}
        >
          <span>Evaluator</span>
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

        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? "Signing In..." : "Sign In"}
        </Button>
      </form>

      {/* Quick Autofill Demo Section */}
      <div className="pt-4 border-t border-[var(--line)]">
        <div className="flex items-center gap-1.5 text-[11px] font-mono-data text-[var(--ink-muted)] mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--highlight)]" />
          <span>Evaluation Demo Personas (1-Click Login):</span>
        </div>

        <div className="space-y-1.5">
          {ACTIVE_PERSONAS.map((persona) => (
            <button
              key={persona.id}
              type="button"
              disabled={submitting}
              onClick={() => handleAutofillPersona(persona)}
              className="w-full text-left p-2 rounded-[6px] border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] text-xs flex items-center justify-between transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              <div>
                <div className="font-semibold text-[var(--ink)]">{persona.name}</div>
                <div className="text-[10px] text-[var(--ink-muted)]">
                  {persona.orgName} ·{" "}
                  {persona.role === "startup"
                    ? `DPIIT ${persona.dpiitNumber}`
                    : persona.role === "evaluator"
                      ? "Technical Evaluator"
                      : "Government Officer"}
                </div>
              </div>
              <span
                className={`text-[10px] font-mono-data font-semibold ${
                  persona.role === "startup"
                    ? "text-[var(--highlight)]"
                    : persona.role === "evaluator"
                      ? "text-[#6D28D9]"
                      : "text-[var(--accent)]"
                }`}
              >
                Enter Portal →
              </span>
            </button>
          ))}
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
