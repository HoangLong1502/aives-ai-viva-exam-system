"use client";

import { StatusBadge } from "@/components/teacher/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  examStatusCounts,
  examStatusPresentation,
  type AdminStats,
  type CountedExamStatus,
} from "@/lib/admin/dashboard";
import type { Messages } from "@/lib/i18n/messages/en";
import { EmptyState } from "@/components/admin/ui/dashboard-ui";

type ExamCopy = Messages["admin"]["dashboard"]["exams"];

const STATUS_LABEL: Record<CountedExamStatus, keyof ExamCopy> = {
  SCHEDULED: "scheduled",
  IN_PROGRESS: "inProgress",
  COMPLETED: "completed",
};

export function ExamStatusPanel({ stats, copy }: { stats: AdminStats; copy: ExamCopy }) {
  const rows = examStatusCounts(stats);
  const max = Math.max(...rows.map((row) => row.total));
  const labelFor = (status: CountedExamStatus) => copy[STATUS_LABEL[status]];

  if (max === 0) {
    return (
      <Card className="min-w-0">
        <CardContent>
          <EmptyState title={copy.empty} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container min-w-0">
      <CardContent className="space-y-5">
        <ul className="grid gap-3 @xl:grid-cols-3" aria-label={copy.chartLabel}>
          {rows.map((row) => {
            const presentation = examStatusPresentation(row.status);
            const share = (row.total / max) * 100;
            const multipleChoiceShare = row.total === 0 ? 0 : (row.multipleChoice / row.total) * 100;
            return (
              <li
                key={row.status}
                className="flex flex-col rounded-xl bg-muted/50 p-4 ring-1 ring-foreground/[0.04]"
              >
                <div className="flex items-start justify-between gap-3">
                  <StatusBadge label={labelFor(row.status)} variant={presentation.tone} />
                  <p className="font-serif text-3xl leading-none tabular-nums tracking-tight">
                    {row.total.toLocaleString()}
                  </p>
                </div>
                <div
                  className="mt-4 h-1.5 overflow-hidden rounded-full bg-background ring-1 ring-foreground/[0.05]"
                  aria-hidden
                >
                  <div className="flex h-full" style={{ width: `${share}%` }}>
                    <div className="h-full bg-primary" style={{ width: `${multipleChoiceShare}%` }} />
                    <div className="h-full bg-highlight" style={{ width: `${100 - multipleChoiceShare}%` }} />
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">{copy.multipleChoice}</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">{row.multipleChoice.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{copy.oral}</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">{row.oral.toLocaleString()}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" aria-hidden />
            {copy.multipleChoice}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-highlight" aria-hidden />
            {copy.oral}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
