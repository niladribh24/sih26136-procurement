import React from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  helperText?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, helperText, error, id, className = "", ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-medium text-[var(--ink-secondary)] uppercase tracking-wider"
          >
            {label}
            {props.required && <span className="text-[var(--danger)] ml-1">*</span>}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={`px-3 py-2 text-sm bg-[var(--surface-raised)] border ${
            error ? "border-[var(--danger)] ring-1 ring-[var(--danger)]" : "border-[var(--line)]"
          } rounded-[6px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors duration-150 cursor-pointer ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
        {!error && helperText && (
          <span className="text-xs text-[var(--ink-muted)]">{helperText}</span>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
