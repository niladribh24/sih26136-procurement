import React from "react";
import { ShieldCheck } from "lucide-react";

export interface AuditStampProps {
  actorName: string;
  actorRole: string;
  timestamp: string;
  hash?: string;
  className?: string;
}

export const AuditStamp: React.FC<AuditStampProps> = ({
  actorName,
  actorRole,
  timestamp,
  hash,
  className = "",
}) => {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[var(--surface-subtle)] border border-[var(--line)] text-[11px] font-mono-data text-[var(--ink-muted)] ${className}`}
    >
      <ShieldCheck className="w-3.5 h-3.5 text-[var(--positive)]" />
      <span>
        Recorded by: <strong className="text-[var(--ink)]">{actorName}</strong> ({actorRole})
      </span>
      <span>·</span>
      <span>{timestamp}</span>
      {hash && (
        <>
          <span>·</span>
          <span className="text-[var(--ink-faint)]">#{hash}</span>
        </>
      )}
    </div>
  );
};
