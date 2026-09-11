import React from "react";
import Link from "next/link";
import { Shield } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--canvas)] flex flex-col items-center justify-center p-4">
      <div className="mb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-[6px] bg-[var(--accent)] flex items-center justify-center text-white shadow-xs">
            <Shield className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="text-xl font-bold tracking-wider text-[var(--accent)] font-editorial">
              SAMARTH
            </div>
            <div className="text-[11px] text-[var(--ink-muted)]">
              Public Procurement & Startup Innovation Platform
            </div>
          </div>
        </Link>
      </div>

      <div className="w-full max-w-md bg-[var(--surface-raised)] border border-[var(--line)] rounded-[10px] shadow-sm p-8">
        {children}
      </div>

      <div className="mt-6 text-center text-xs text-[var(--ink-muted)]">
        <Link href="/" className="hover:underline">
          ← Back to Gateway
        </Link>
      </div>
    </div>
  );
}
