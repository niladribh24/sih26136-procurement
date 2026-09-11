"use client";

import React, { useEffect, useState } from "react";
import { TopHeader } from "./TopHeader";
import { Sidebar } from "./Sidebar";
import { getSession } from "@/lib/auth";
import { UserRole } from "@/lib/types";

interface AppShellProps {
  role: UserRole;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ role, children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex flex-col">
        <div className="h-16 bg-[var(--surface-raised)] border-b border-[var(--line)]" />
        <div className="flex-1 flex items-center justify-center text-sm text-[var(--ink-muted)] font-mono-data">
          Verifying sovereign security credentials...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)] flex flex-col">
      <TopHeader />
      <div className="flex-1 flex max-w-[1440px] w-full mx-auto">
        <Sidebar role={role} />
        <main className="flex-1 p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
};
