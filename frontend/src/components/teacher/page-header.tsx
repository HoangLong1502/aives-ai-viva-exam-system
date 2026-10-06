"use client";

import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "cn";

export type BreadcrumbItem = {
  href?: string;
  label: string;
};

export function TeacherPageHeader({
  eyebrow,
  title,
  description,
  action,
  breadcrumbs,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <header className={cn("space-y-4", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
                {index > 0 ? <ChevronRightIcon className="size-3.5 shrink-0 opacity-60" aria-hidden /> : null}
                {item.href && !isLast ? (
                  <Link href={item.href} className="hover:text-foreground">
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-foreground" : undefined}>{item.label}</span>
                )}
              </span>
            );
          })}
        </nav>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {eyebrow ? (
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
          ) : null}
          <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">{title}</h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
      </div>
    </header>
  );
}
