import type { ReactNode } from "react";
import { cn } from "cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-2">
        {eyebrow ? (
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <span className="h-px w-6 bg-highlight" aria-hidden />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-serif text-3xl tracking-tight text-balance sm:text-[2.6rem] sm:leading-[1.1]">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h2 id={id} className="font-serif text-2xl tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export function LoadingSkeleton({ className, label }: { className?: string; label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("animate-pulse rounded-2xl bg-muted motion-reduce:animate-none", className)}
    />
  );
}

export function EmptyState({ title }: { title: string }) {
  return <p className="px-4 py-10 text-center text-sm text-muted-foreground">{title}</p>;
}

export function ErrorState({
  title,
  message,
  retryLabel,
  onRetry,
  disabled = false,
}: {
  title: string;
  message: string;
  retryLabel: string;
  onRetry: () => void;
  disabled?: boolean;
}) {
  return (
    <div role="alert" className="rounded-2xl bg-destructive/5 px-5 py-4 ring-1 ring-destructive/25">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={disabled}
        className="mt-3 inline-flex h-9 items-center rounded-lg border border-border bg-card px-3.5 text-sm font-medium shadow-xs hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
      >
        {retryLabel}
      </button>
    </div>
  );
}
