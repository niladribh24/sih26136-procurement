"use client";

import React, { useState } from "react";
import { X, Plus, Sparkles } from "lucide-react";

export interface StartupTagListProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  readOnly?: boolean;
}

export const StartupTagList: React.FC<StartupTagListProps> = ({
  tags,
  onChange,
  readOnly = false,
}) => {
  const [newTag, setNewTag] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleRemove = (indexToRemove: number) => {
    if (readOnly) return;
    onChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTag.trim() || readOnly) return;
    const clean = newTag.trim();
    if (!tags.includes(clean)) {
      onChange([...tags, clean]);
    }
    setNewTag("");
    setIsAdding(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-secondary)]">
          <Sparkles className="w-3.5 h-3.5 text-[var(--highlight)]" />
          <span>Extracted Technical Competencies & Tags:</span>
        </div>
        {!readOnly && !isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-[11px] text-[var(--accent)] font-medium hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Capability</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {tags.map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[var(--surface-raised)] border border-[var(--line)] text-xs font-medium text-[var(--ink)] shadow-2xs"
          >
            <span>{tag}</span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="p-0.5 rounded text-[var(--ink-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors cursor-pointer"
                title="Remove tag"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}

        {!readOnly && isAdding && (
          <div className="inline-flex items-center gap-1">
            <input
              type="text"
              autoFocus
              placeholder="e.g. Edge Compute"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                } else if (e.key === "Escape") {
                  setIsAdding(false);
                }
              }}
              className="px-2 py-0.5 text-xs bg-[var(--surface-raised)] border border-[var(--accent)] rounded-[4px] text-[var(--ink)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleAdd()}
              className="px-2 py-0.5 text-xs bg-[var(--accent)] text-white rounded-[4px] cursor-pointer"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="p-1 text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
