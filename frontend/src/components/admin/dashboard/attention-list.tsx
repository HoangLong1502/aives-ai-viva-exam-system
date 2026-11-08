import type { ReactNode } from "react";
import Link from "next/link";
import { BookOpenIcon, CircleCheckIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { subjectsMissingTeachers, type AdminSubject } from "@/lib/admin/dashboard";
import type { Messages } from "@/lib/i18n/messages/en";

type AttentionCopy = Messages["admin"]["dashboard"]["attention"];

export function AttentionList({
  subjects,
  copy,
  countLabel,
}: {
  subjects: AdminSubject[];
  copy: AttentionCopy;
  countLabel: (count: number) => string;
}) {
  if (subjects.length === 0) {
    return (
      <Card className="min-w-0">
        <CardContent>
          <QuietNote title={copy.emptySubjects} icon={<BookOpenIcon className="size-4" aria-hidden />} />
        </CardContent>
      </Card>
    );
  }

  const missing = subjectsMissingTeachers(subjects);
  if (missing.length === 0) {
    return (
      <Card className="min-w-0">
        <CardContent>
          <QuietNote
            title={copy.emptyAssigned}
            icon={<CircleCheckIcon className="size-4" aria-hidden />}
            tone="success"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0">
      <CardContent className="px-0">
        <div className="flex items-center justify-between gap-3 px-5 pb-3">
          <p className="text-sm text-muted-foreground">{countLabel(missing.length)}</p>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-highlight/25 px-2 text-xs font-medium tabular-nums text-foreground ring-1 ring-highlight/40">
            {missing.length.toLocaleString()}
          </span>
        </div>
        <ul className="max-h-80 divide-y divide-border/70 overflow-y-auto border-t border-border/70">
          {missing.map((subject) => (
            <li key={subject.id} className="flex items-center gap-3 px-5 py-3.5">
              <span className="shrink-0 rounded-md bg-muted px-2 py-1 font-mono text-[11px] font-medium tracking-wide text-foreground">
                {subject.code}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm">{subject.name}</p>
              <Link
                href="/admin/settings"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {copy.assign}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function QuietNote({
  title,
  icon,
  tone = "muted",
}: {
  title: string;
  icon: ReactNode;
  tone?: "muted" | "success";
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span
        className={
          tone === "success"
            ? "flex size-10 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-800 ring-1 ring-emerald-600/15"
            : "flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-foreground/10"
        }
      >
        {icon}
      </span>
      <p className="max-w-xs text-sm leading-6 text-muted-foreground">{title}</p>
    </div>
  );
}
