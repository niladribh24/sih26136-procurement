import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "highlight" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5",
  };

  const variants = {
    primary:
      "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:bg-[var(--accent-hover)] shadow-xs",
    secondary:
      "bg-[var(--surface-raised)] border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface)] hover:border-[var(--line-strong)]",
    highlight:
      "bg-[var(--highlight)] text-white hover:bg-[var(--highlight-hover)] shadow-xs",
    danger:
      "bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)] hover:bg-[var(--danger)] hover:text-white",
    ghost:
      "bg-transparent text-[var(--ink-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]",
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
