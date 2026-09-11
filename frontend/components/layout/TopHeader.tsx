"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  UserCheck,
  LogOut,
  ChevronDown,
  Building2,
  Rocket,
  CheckCircle2,
} from "lucide-react";
import { DEMO_PERSONAS, getSession, setSession, clearSession } from "@/lib/auth";
import { UserSession } from "@/lib/types";

export const TopHeader: React.FC = () => {
  const router = useRouter();
  const [session, setCurrentSession] = useState<UserSession | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    setCurrentSession(getSession());
  }, []);

  const handleSwitchPersona = (persona: UserSession) => {
    setSession(persona);
    setCurrentSession(persona);
    setDropdownOpen(false);

    // Navigate to respective dashboard
    if (persona.role === "startup") {
      router.push("/startup/problems");
    } else {
      router.push("/gov/problems");
    }
  };

  const handleLogout = () => {
    clearSession();
    setCurrentSession(null);
    router.push("/login");
  };

  return (
    <header className="w-full bg-[var(--surface-raised)] border-b border-[var(--line)] sticky top-0 z-40">
      <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left: Brand / Emblem */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-[6px] bg-[var(--accent)] flex items-center justify-center text-white shadow-xs">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-wider text-base text-[var(--accent)] font-editorial">
                  SAMARTH
                </span>
                <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] text-[var(--ink-muted)] border border-[var(--line)]">
                  SIH26136
                </span>
              </div>
              <p className="text-[11px] text-[var(--ink-muted)] tracking-tight">
                Public Procurement & Startup Innovation Engine
              </p>
            </div>
          </Link>
        </div>

        {/* Right: Demo Persona Switcher & Session Controls */}
        <div className="flex items-center gap-4">
          {/* Persona Switcher Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[var(--surface)] border border-[var(--line)] text-xs font-medium text-[var(--ink)] hover:border-[var(--line-strong)] transition-colors cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>
                Role:{" "}
                <strong className="text-[var(--accent)] capitalize">
                  {session ? session.role.replace("_", " ") : "Not Signed In"}
                </strong>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] shadow-xl p-2 z-50">
                <div className="px-2 py-1.5 border-b border-[var(--line)] mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                    Switch Active Persona (True RBAC)
                  </span>
                </div>
                <div className="space-y-1">
                  {DEMO_PERSONAS.map((persona) => {
                    const isSelected = session?.id === persona.id;
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => handleSwitchPersona(persona)}
                        className={`w-full text-left p-2 rounded-[6px] transition-colors flex items-start justify-between cursor-pointer ${
                          isSelected
                            ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "hover:bg-[var(--surface-subtle)] text-[var(--ink)]"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {persona.role === "startup" ? (
                            <Rocket className="w-4 h-4 mt-0.5 text-[var(--highlight)] shrink-0" />
                          ) : (
                            <Building2 className="w-4 h-4 mt-0.5 text-[var(--accent)] shrink-0" />
                          )}
                          <div>
                            <div className="text-xs font-semibold">{persona.name}</div>
                            <div className="text-[11px] text-[var(--ink-muted)] truncate max-w-[180px]">
                              {persona.orgName}
                            </div>
                            <div className="text-[10px] font-mono-data text-[var(--ink-faint)] capitalize">
                              Role: {persona.role.replace("_", " ")}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* User Display & Sign out */}
          {session && (
            <div className="flex items-center gap-3 pl-3 border-l border-[var(--line)]">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-[var(--ink)]">{session.name}</div>
                <div className="text-[10px] text-[var(--ink-muted)] truncate max-w-[140px]">
                  {session.orgName}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Sign Out"
                className="p-1.5 rounded-[6px] text-[var(--ink-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
