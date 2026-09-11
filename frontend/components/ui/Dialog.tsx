"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidthClass = "max-w-lg",
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      <div
        className={`relative w-full ${maxWidthClass} bg-[var(--surface-raised)] border border-[var(--line)] rounded-[8px] shadow-2xl p-6 z-10`}
      >
        <div className="flex items-start justify-between border-b border-[var(--line)] pb-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--ink)] font-editorial">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-[var(--ink-muted)] mt-1">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
};
