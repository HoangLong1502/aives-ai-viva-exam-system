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
    <Card className="min-w-0">
      <CardContent className="grid gap-6 pt-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ul className="space-y-4" aria-hidden="true">
          {rows.map((row) => (
            <li key={row.status}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span>{labelFor(row.status)}</span>
                <span className="font-medium tabular-nums">{row.total.toLocaleString()}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full motion-safe:transition-[width] ${examStatusPresentation(row.status).barClass}`}
                  style={{ width: `${(row.total / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>

        <div className="min-w-0 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{copy.chartLabel}</caption>
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  {copy.status}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {copy.multipleChoice}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {copy.oral}
                </th>
                <th scope="col" className="py-2 pl-3 text-right font-medium">
                  {copy.total}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.status} className="border-b last:border-0">
                  <th scope="row" className="py-2.5 pr-3 font-normal">
                    <StatusBadge
                      label={labelFor(row.status)}
                      variant={examStatusPresentation(row.status).tone}
                    />
                  </th>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {row.multipleChoice.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.oral.toLocaleString()}</td>
                  <td className="py-2.5 pl-3 text-right font-medium tabular-nums">
                    {row.total.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
