import React from "react";
import { TopHeader } from "./TopHeader";
import { Sidebar } from "./Sidebar";
import { UserRole } from "@/lib/types";

interface AppShellProps {
  role: UserRole;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ role, children }) => {
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
