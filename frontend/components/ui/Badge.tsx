import React from "react";

export interface BadgeProps {
  variant?:
    | "default"
    | "dpiit_verified"
    | "dpiit_pending"
    | "highlight"
    | "positive"
    | "warning"
    | "danger"
    | "info"
    | "mono";
  size?: "sm" | "md";
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "default",
  size = "md",
  children,
  className = "",
}) => {
  const base = "inline-flex items-center font-medium rounded-[4px] select-none";

  const sizes = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
  };

  const variants = {
    default: "bg-[var(--surface-subtle)] text-[var(--ink-secondary)] border border-[var(--line)]",
    dpiit_verified:
      "bg-[var(--positive-soft)] text-[var(--positive)] border border-[var(--positive)]/30 font-mono-data font-semibold",
    dpiit_pending:
      "bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning)]/30 font-mono-data",
    highlight:
      "bg-[var(--highlight-soft)] text-[var(--highlight)] border border-[var(--highlight)]/30 font-semibold",
    positive:
      "bg-[var(--positive-soft)] text-[var(--positive)] border border-[var(--positive)]/30",
    warning:
      "bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning)]/30",
    danger:
      "bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/30",
    info:
      "bg-[var(--info-soft)] text-[var(--info)] border border-[var(--info)]/30",
    mono:
      "bg-[var(--surface-subtle)] text-[var(--ink)] border border-[var(--line-strong)] font-mono-data text-[11px]",
  };

  return (
    <span className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};
