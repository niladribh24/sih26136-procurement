import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, id, className = "", ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-[var(--ink-secondary)] uppercase tracking-wider"
          >
            {label}
            {props.required && <span className="text-[var(--danger)] ml-1">*</span>}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`px-3 py-2 text-sm bg-[var(--surface-raised)] border ${
            error ? "border-[var(--danger)] ring-1 ring-[var(--danger)]" : "border-[var(--line)]"
          } rounded-[6px] text-[var(--ink)] placeholder-[var(--ink-faint)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors duration-150 ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
        {!error && helperText && (
          <span className="text-xs text-[var(--ink-muted)]">{helperText}</span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
