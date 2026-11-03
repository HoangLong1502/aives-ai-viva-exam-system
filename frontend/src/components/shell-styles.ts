import { cn } from "cn";

/** Class names shared by the admin, teacher and student shells so the three portals look the same. */

export const shellHeaderClass =
  "sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/70 px-4 backdrop-blur-xl sm:px-6";

export const shellBrandEyebrowClass =
  "hidden text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground sm:block";

export const shellAccountTriggerClass =
  "inline-flex h-10 items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm ring-1 ring-transparent transition-colors hover:bg-card hover:ring-border focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

export function shellAsideClass(collapsed: boolean) {
  return cn(
    "sticky top-16 hidden h-[calc(100svh-4rem)] shrink-0 border-r border-border/70 bg-sidebar backdrop-blur motion-safe:transition-[width] motion-safe:duration-200 md:flex md:flex-col",
    collapsed ? "w-[4.25rem]" : "w-60",
  );
}

export const shellMainClass = "mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-10";

export function shellNavItemClass({
  active,
  collapsed,
  compact,
}: {
  active: boolean;
  collapsed: boolean;
  compact: boolean;
}) {
  return cn(
    "flex items-center rounded-lg text-sm whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
    collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2",
    active
      ? "bg-card font-medium text-foreground shadow-soft ring-1 ring-foreground/[0.07] [&_svg]:text-primary"
      : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
    compact && active && "shadow-none",
  );
}
