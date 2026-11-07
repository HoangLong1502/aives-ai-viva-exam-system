import Link from "next/link";
import { ArrowUpRightIcon, BookOpenIcon, ClipboardListIcon, SettingsIcon, UsersIcon } from "lucide-react";
import type { Messages } from "@/lib/i18n/messages/en";
import { cn } from "cn";

type ActionCopy = Messages["admin"]["dashboard"]["actions"];

const ACTIONS = [
  {
    href: "/admin/people",
    icon: UsersIcon,
    label: "people",
    hint: "peopleHint",
    iconClass: "bg-primary/[0.08] text-primary ring-primary/10",
  },
  {
    href: "/admin/performance",
    icon: ClipboardListIcon,
    label: "performance",
    hint: "performanceHint",
    iconClass: "bg-highlight/25 text-foreground ring-highlight/40",
  },
  {
    href: "/admin/settings",
    icon: SettingsIcon,
    label: "settings",
    hint: "settingsHint",
    iconClass: "bg-foreground/[0.05] text-foreground/80 ring-foreground/10",
  },
  {
    href: "/admin/knowledge",
    icon: BookOpenIcon,
    label: "knowledge",
    hint: "knowledgeHint",
    iconClass: "bg-accent text-accent-foreground ring-highlight/30",
  },
] as const;

export function QuickActions({ copy }: { copy: ActionCopy }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <li key={action.href}>
            <Link
              href={action.href}
              className="group flex h-full items-start gap-3 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-foreground/[0.07] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-raised focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1",
                  action.iconClass,
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{copy[action.label]}</span>
                  <ArrowUpRightIcon
                    className="size-3.5 shrink-0 text-muted-foreground opacity-50 transition-[opacity,transform] duration-200 group-hover:-translate-y-px group-hover:translate-x-px group-hover:opacity-100"
                    aria-hidden
                  />
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {copy[action.hint]}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
