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
        "flex min-h-32 flex-col rounded-2xl bg-card p-5 shadow-soft ring-1 ring-foreground/[0.07] transition-[box-shadow,transform] duration-150",
        "hover:-translate-y-px hover:shadow-raised focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        emphasis && "ring-highlight/60",
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.06] text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
      </span>
      <span className="mt-2 font-serif text-4xl tabular-nums tracking-tight">
        {value.toLocaleString()}
      </span>
      <span className="mt-2 text-xs leading-5 text-muted-foreground">{scope}</span>
    </Link>
  );
}
