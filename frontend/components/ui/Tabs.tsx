"use client";

import React from "react";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = "",
}) => {
  return (
    <div className={`flex border-b border-[var(--line)] gap-2 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`pb-2.5 px-3 text-sm font-medium transition-colors relative cursor-pointer flex items-center gap-2 ${
              isActive
                ? "text-[var(--accent)] font-semibold"
                : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono-data ${
                  isActive
                    ? "bg-[var(--accent-soft)] text-[var(--accent)] font-bold"
                    : "bg-[var(--surface-subtle)] text-[var(--ink-muted)]"
                }`}
              >
                {tab.count}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)]" />
            )}
          </button>
        );
      })}
    </div>
  );
};
