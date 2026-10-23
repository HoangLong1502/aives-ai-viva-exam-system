"use client";

import { cn } from "cn";

const VARIANTS = {
  neutral: "bg-muted text-muted-foreground ring-foreground/10",
  warning: "bg-amber-500/12 text-amber-900 ring-amber-600/20 dark:text-amber-200",
  success: "bg-emerald-500/12 text-emerald-900 ring-emerald-600/20 dark:text-emerald-200",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
  info: "bg-primary/8 text-primary ring-primary/15",
} as const;

export function StatusBadge({
  label,
  variant = "neutral",
  className,
}: {
  label: string;
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        VARIANTS[variant],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function questionStatusVariant(status: string): keyof typeof VARIANTS {
  switch (status) {
    case "PENDING_REVIEW":
      return "warning";
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "danger";
    default:
      return "neutral";
  }
}

export function attemptStatusVariant(status: string): keyof typeof VARIANTS {
  switch (status) {
    case "SCORED":
      return "success";
    case "ENTERED":
      return "info";
    default:
      return "neutral";
  }
}
