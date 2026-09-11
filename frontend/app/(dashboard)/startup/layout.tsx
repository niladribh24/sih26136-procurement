import React from "react";
import { AppShell } from "@/components/layout/AppShell";

export default function StartupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell role="startup">{children}</AppShell>;
}
