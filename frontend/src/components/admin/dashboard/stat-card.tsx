import Link from "next/link";
import { ArrowUpRightIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";

const TONES = {
  navy: {
    icon: "bg-primary/[0.08] text-primary ring-1 ring-primary/10",
    bar: "bg-primary",
  },
  amber: {
    icon: "bg-highlight/25 text-foreground ring-1 ring-highlight/45",
    bar: "bg-highlight",
  },
  ink: {
    icon: "bg-foreground/[0.05] text-foreground/80 ring-1 ring-foreground/10",
    bar: "bg-foreground/30",
  },
} as const;

export type StatTone = keyof typeof TONES;

export function StatCard({
  label,
  value,
  scope,
  hint,
  href,
  icon: Icon,
  tone = "navy",
  emphasis = false,
}: {
  label: string;
  value: number;
  scope: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  tone?: StatTone;
  emphasis?: boolean;
}) {
  const palette = TONES[tone];

  return (
    <Link
      href={href}
      title={hint}
      className={cn(
        "group relative flex min-h-36 flex-col overflow-hidden rounded-2xl bg-card p-5 pl-6 shadow-soft ring-1 ring-foreground/[0.07]",
        "transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-raised",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        emphasis && "bg-gradient-to-br from-accent via-card to-card ring-highlight/50",
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-4 left-0 w-1 rounded-r-full", palette.bar)} />
      <span className="flex items-start justify-between gap-3">
        <span className="pt-1 text-[0.8125rem] font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", palette.icon)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </span>
      <span className="mt-3 font-serif text-[2.65rem] leading-none tabular-nums tracking-tight">
        {value.toLocaleString()}
      </span>
      <span className="mt-auto flex items-end justify-between gap-3 pt-3 text-xs leading-5 text-muted-foreground">
        <span>{scope}</span>
        <ArrowUpRightIcon
          className="mb-0.5 size-3.5 shrink-0 opacity-40 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden
        />
      </span>
    </Link>
  );
}
