import Link from "next/link";
import { BookOpenIcon, ClipboardListIcon, SettingsIcon, UsersIcon } from "lucide-react";
import type { Messages } from "@/lib/i18n/messages/en";

type ActionCopy = Messages["admin"]["dashboard"]["actions"];

const ACTIONS = [
  {
    href: "/admin/people",
    icon: UsersIcon,
    label: "people",
    hint: "peopleHint",
  },
  {
    href: "/admin/performance",
    icon: ClipboardListIcon,
    label: "performance",
    hint: "performanceHint",
  },
  {
    href: "/admin/settings",
    icon: SettingsIcon,
    label: "settings",
    hint: "settingsHint",
  },
  {
    href: "/admin/knowledge",
    icon: BookOpenIcon,
    label: "knowledge",
    hint: "knowledgeHint",
  },
] as const;

export function QuickActions({ copy }: { copy: ActionCopy }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <li key={action.href}>
            <Link
              href={action.href}
              className="flex h-full items-start gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-soft ring-1 ring-foreground/[0.07] transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-raised focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.06] text-primary">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{copy[action.label]}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
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
