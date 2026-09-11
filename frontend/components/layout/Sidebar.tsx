"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  FileText,
  Clock,
  Building2,
  Share2,
  PlusCircle,
  ShieldAlert,
} from "lucide-react";
import { UserRole } from "@/lib/types";

interface SidebarProps {
  role: UserRole;
}

export const Sidebar: React.FC<SidebarProps> = ({ role }) => {
  const pathname = usePathname();

  const startupLinks = [
    {
      href: "/startup/problems",
      label: "Problem Browser",
      icon: Compass,
      stage: "Stage 1: Identify",
    },
    {
      href: "/startup/proposals",
      label: "My Proposals",
      icon: FileText,
      stage: "Submissions",
    },
    {
      href: "/startup/pilots",
      label: "Active Pilots",
      icon: Clock,
      stage: "Stage 2: Pilot",
    },
    {
      href: "/startup/profile",
      label: "DPIIT Profile & AI Tags",
      icon: Building2,
      stage: "Capabilities",
    },
    {
      href: "/startup/scale",
      label: "Proven Solutions",
      icon: Share2,
      stage: "Stage 4: Scale",
    },
  ];

  const govLinks = [
    {
      href: "/gov/problems",
      label: "My Problems & Shortlists",
      icon: FileText,
      stage: "Stage 1: Identify",
    },
    {
      href: "/gov/problems/new",
      label: "Post a Problem",
      icon: PlusCircle,
      stage: "Challenge Intake",
    },
    {
      href: "/gov/pilots",
      label: "Pilot Tracker",
      icon: Clock,
      stage: "Stage 2 & 3: Pilot / Procure",
    },
    {
      href: "/gov/scale",
      label: "Scale Repository",
      icon: Share2,
      stage: "Stage 4: Scale",
    },
  ];

  const links = role === "startup" ? startupLinks : govLinks;

  const getRoleLabel = () => {
    if (role === "startup") return "Startup Workspace";
    if (role === "evaluator") return "Technical Evaluator";
    return "Government Authority";
  };

  return (
    <aside className="hidden md:flex w-64 shrink-0 bg-[var(--surface)] border-r border-[var(--line)] min-h-[calc(100vh-4rem)] p-4 flex-col justify-between print:hidden">
      <div className="space-y-6">
        <div>
          <span className="text-[10px] font-mono-data uppercase tracking-wider text-[var(--ink-muted)] px-3">
            {getRoleLabel()}
          </span>
          <nav className="mt-2 space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive =
                pathname === link.href ||
                (link.href === "/gov/problems"
                  ? pathname.startsWith("/gov/problems/") && !pathname.startsWith("/gov/problems/new")
                  : pathname.startsWith(`${link.href}/`));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-xs font-medium transition-colors duration-150 ${
                    isActive
                      ? "bg-[var(--accent-soft)] text-[var(--accent)] font-semibold border-l-[3px] border-[var(--accent)]"
                      : "text-[var(--ink-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-[var(--accent)]" : "text-[var(--ink-muted)]"}`} />
                  <div className="flex flex-col">
                    <span>{link.label}</span>
                    <span className="text-[10px] text-[var(--ink-faint)] font-mono-data">
                      {link.stage}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* RBAC Verified Footnote */}
      <div className="p-3 bg-[var(--surface-subtle)] border border-[var(--line)] rounded-[6px] text-[11px] text-[var(--ink-muted)]">
        <div className="flex items-center gap-1.5 font-medium text-[var(--ink)]">
          <ShieldAlert className="w-3.5 h-3.5 text-[var(--positive)]" />
          <span>Strict RBAC Active</span>
        </div>
        <p className="text-[10px] text-[var(--ink-muted)] mt-1 leading-tight">
          Session gated by Edge Middleware. Zero cross-role data leakage.
        </p>
      </div>
    </aside>
  );
};
