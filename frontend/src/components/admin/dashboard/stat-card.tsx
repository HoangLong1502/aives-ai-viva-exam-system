import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

export function StatCard({
  label,
  value,
  scope,
  hint,
  href,
  icon: Icon,
  emphasis = false,
}: {
  label: string;
  value: number;
  scope: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      title={hint}
      className={cn(
        "flex min-h-32 flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/10",
        "hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        emphasis && "ring-primary/40",
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </span>
      <span className="mt-3 font-serif text-3xl tabular-nums tracking-tight">
        {value.toLocaleString()}
      </span>
      <span className="mt-2 text-xs leading-5 text-muted-foreground">{scope}</span>
    </Link>
  );
}
