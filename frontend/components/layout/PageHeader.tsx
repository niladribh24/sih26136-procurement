import React from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  code?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  code,
  badge,
  actions,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--line)] mb-8">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          {code && (
            <span className="px-2 py-0.5 text-xs font-mono-data bg-[var(--surface-subtle)] text-[var(--ink-secondary)] border border-[var(--line)] rounded-[4px]">
              {code}
            </span>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] font-editorial">
            {title}
          </h1>
          {badge && <div>{badge}</div>}
        </div>
        {subtitle && (
          <p className="text-sm text-[var(--ink-muted)] max-w-3xl">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
};
