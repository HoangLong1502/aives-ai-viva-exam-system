"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/teacher/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { examStatusPresentation, type AdminAttempt } from "@/lib/admin/dashboard";
import type { Locale } from "@/lib/i18n/locale-provider";
import type { Messages } from "@/lib/i18n/messages/en";
import { EmptyState } from "@/components/admin/ui/dashboard-ui";
import { Pager, SelectControl, TableScroller } from "@/components/admin/ui/controls";
import { Label } from "@/components/ui/label";
import { cn } from "cn";

type AttemptCopy = Messages["admin"]["dashboard"]["attempts"];
type ExamCopy = Messages["admin"]["dashboard"]["exams"];
type SortKey = "examTitle" | "studentName" | "teacherName" | "score" | "status";
type SortState = { key: SortKey; direction: "asc" | "desc" } | null;

const PAGE_SIZE = 8;

const KNOWN_STATUS_LABEL: Record<string, keyof ExamCopy> = {
  SCHEDULED: "scheduled",
  IN_PROGRESS: "inProgress",
  COMPLETED: "completed",
  DRAFT: "draft",
  PUBLISHED: "published",
};

export function AttemptTable({
  attempts,
  copy,
  examCopy,
  locale,
}: {
  attempts: AdminAttempt[];
  copy: AttemptCopy;
  examCopy: ExamCopy;
  locale: Locale;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(1);

  const statuses = useMemo(() => {
    return [...new Set(attempts.map((attempt) => attempt.status))].sort((left, right) =>
      statusLabel(left, examCopy).localeCompare(statusLabel(right, examCopy), locale),
    );
  }, [attempts, examCopy, locale]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    const matched = attempts.filter((attempt) => {
      if (status !== "all" && attempt.status !== status) return false;
      if (!needle) return true;
      return [attempt.examTitle, attempt.studentName, attempt.teacherName]
        .join(" ")
        .toLocaleLowerCase(locale)
        .includes(needle);
    });
    const indexed = matched.map((attempt, index) => ({ attempt, index }));
    if (!sort) return indexed.map((item) => item.attempt);
    indexed.sort((left, right) => {
      const compared = compareAttempts(left.attempt, right.attempt, sort.key, examCopy, locale);
      if (compared === 0) return left.index - right.index;
      const scoreNull =
        sort.key === "score" && (left.attempt.score === null || right.attempt.score === null);
      if (scoreNull) return compared;
      return sort.direction === "asc" ? compared : -compared;
    });
    return indexed.map((item) => item.attempt);
  }, [attempts, examCopy, locale, query, sort, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function updateStatus(value: string) {
    setStatus(value);
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
    setPage(1);
  }

  if (attempts.length === 0) {
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
      <CardContent className="min-w-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="attempt-search">{copy.searchLabel}</Label>
            <Input
              id="attempt-search"
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="attempt-status">{copy.statusLabel}</Label>
            <SelectControl
              id="attempt-status"
              value={status}
              onChange={(event) => updateStatus(event.target.value)}
            >
              <option value="all">{copy.allStatuses}</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {statusLabel(item, examCopy)}
                </option>
              ))}
            </SelectControl>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title={copy.noResults} />
        ) : (
          <>
            <TableScroller>
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <SortHeader
                      label={copy.exam}
                      column="examTitle"
                      sort={sort}
                      onSort={toggleSort}
                      sortLabel={copy.sort}
                    />
                    <SortHeader
                      label={copy.student}
                      column="studentName"
                      sort={sort}
                      onSort={toggleSort}
                      sortLabel={copy.sort}
                    />
                    <SortHeader
                      label={copy.teacher}
                      column="teacherName"
                      sort={sort}
                      onSort={toggleSort}
                      sortLabel={copy.sort}
                    />
                    <SortHeader
                      label={copy.score}
                      column="score"
                      sort={sort}
                      onSort={toggleSort}
                      sortLabel={copy.sort}
                      align="right"
                    />
                    <SortHeader
                      label={copy.status}
                      column="status"
                      sort={sort}
                      onSort={toggleSort}
                      sortLabel={copy.sort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((attempt) => (
                    <tr key={attempt.id} className="border-b last:border-0">
                      <td className="py-3 pr-3 font-medium">{attempt.examTitle}</td>
                      <td className="px-2 py-3">{attempt.studentName}</td>
                      <td className="px-2 py-3">{attempt.teacherName || "—"}</td>
                      <td className="px-2 py-3 text-right whitespace-nowrap tabular-nums">
                        {attempt.score === null ? (
                          <span aria-label={copy.noScore}>—</span>
                        ) : (
                          attempt.score.toLocaleString(locale)
                        )}
                      </td>
                      <td className="py-3 pl-3 whitespace-nowrap">
                        <StatusBadge
                          label={statusLabel(attempt.status, examCopy)}
                          variant={examStatusPresentation(attempt.status).tone}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroller>
            {pageCount > 1 ? (
              <Pager
                summary={fill(copy.showing, {
                  from: String(start + 1),
                  to: String(start + visible.length),
                  total: String(filtered.length),
                })}
                page={currentPage}
                pages={pageCount}
                pageLabel={fill(copy.page, { page: String(currentPage), pages: String(pageCount) })}
                previousLabel={copy.previous}
                nextLabel={copy.next}
                onPrevious={() => setPage(currentPage - 1)}
                onNext={() => setPage(currentPage + 1)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {fill(copy.showing, {
                  from: String(start + 1),
                  to: String(start + visible.length),
                  total: String(filtered.length),
                })}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ResultsLink({ label }: { label: string }) {
  return (
    <Link href="/admin/performance" className={buttonVariants({ variant: "outline", size: "sm" })}>
      {label}
    </Link>
  );
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  sortLabel,
  align = "left",
}: {
  label: string;
  column: SortKey;
  sort: SortState;
  onSort: (column: SortKey) => void;
  sortLabel: string;
  align?: "left" | "right";
}) {
  const active = sort?.key === column ? sort.direction : undefined;
  return (
    <th
      scope="col"
      aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}
      className={cn("py-2 font-medium", align === "right" ? "px-2 text-right" : "px-2 first:pl-0 last:pr-0")}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex rounded-md hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          align === "right" && "ml-auto",
        )}
        aria-label={sortLabel.replace("{column}", label)}
      >
        {label}
      </button>
    </th>
  );
}

function fill(template: string, params: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => params[name] ?? "");
}

function statusLabel(status: string, examCopy: ExamCopy) {
  const key = KNOWN_STATUS_LABEL[status];
  if (!key) return status;
  const label = examCopy[key];
  return typeof label === "string" ? label : status;
}

function compareAttempts(
  left: AdminAttempt,
  right: AdminAttempt,
  key: SortKey,
  examCopy: ExamCopy,
  locale: Locale,
) {
  if (key === "score") {
    if (left.score === null && right.score === null) return 0;
    if (left.score === null) return 1;
    if (right.score === null) return -1;
    return left.score - right.score;
  }
  const leftText = key === "status" ? statusLabel(left.status, examCopy) : left[key];
  const rightText = key === "status" ? statusLabel(right.status, examCopy) : right[key];
  return leftText.localeCompare(rightText, locale, { sensitivity: "base" });
}
