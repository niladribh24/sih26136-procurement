import React from "react";
import { AppShell } from "@/components/layout/AppShell";

export default function GovernmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell role="govt_officer">{children}</AppShell>;
}
