"use client";

import React, { useSyncExternalStore } from "react";
import { TopHeader } from "./TopHeader";
import { Sidebar } from "./Sidebar";
import { UserRole } from "@/lib/types";
import { getSession, subscribeSession } from "@/lib/auth";

const getServerSnapshot = () => null;

interface AppShellProps {
  role?: UserRole;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ role, children }) => {
  const session = useSyncExternalStore(subscribeSession, getSession, getServerSnapshot);
  const activeRole = session?.role || role || "govt_officer";

  return (
    <div className="h-screen bg-[var(--canvas)] flex flex-col overflow-hidden">
      <TopHeader />
      <div className="flex-1 flex max-w-[1440px] w-full mx-auto overflow-hidden">
        <Sidebar role={activeRole} />
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto overflow-x-hidden print:p-0 print:max-w-none print:overflow-visible">
          {children}
        </main>
      </div>
    </div>
  );
};
