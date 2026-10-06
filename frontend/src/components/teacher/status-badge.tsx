"use client";

import { cn } from "cn";

const VARIANTS = {
  neutral: "bg-muted text-muted-foreground",
  warning: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  success: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-primary/10 text-primary",
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
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
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
