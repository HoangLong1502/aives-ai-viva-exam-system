"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TeacherPageHeader } from "@/components/teacher/page-header";
import { StatusBadge, attemptStatusVariant } from "@/components/teacher/status-badge";
import type { Attempt } from "@/components/score-table";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import { formatAttemptStatus } from "@/lib/teacher/labels";

type Question = { id: string; status: string; subjectName: string };
type Subject = { id: string; code: string; name: string };

export function TeacherOverviewView() {
  const { t, messages } = useLocale();
  const labels = messages.teacher.labels;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [scores, setScores] = useState<Attempt[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<Subject[]>("/api/teaching/subjects", { auth: true }),
      api<Question[]>("/api/teaching/questions", { auth: true }),
      api<Attempt[]>("/api/teaching/scores", { auth: true }),
    ])
      .then(([nextSubjects, nextQuestions, nextScores]) => {
        if (cancelled) return;
        setSubjects(nextSubjects);
        setQuestions(nextQuestions);
        setScores(nextScores);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? err.message : t("teacher.overview.loadError");
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const pendingReview = useMemo(
    () => questions.filter((q) => q.status === "PENDING_REVIEW").length,
    [questions],
  );
  const needsGrading = useMemo(
    () => scores.filter((row) => row.score == null).length,
    [scores],
  );
  const recentAttempts = useMemo(() => scores.slice(0, 5), [scores]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-label={t("teacher.common.loading")} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <TeacherPageHeader title={t("teacher.overview.title")} description={t("teacher.overview.lead")} />
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-8">
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              {t("teacher.common.retry")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <TeacherPageHeader title={t("teacher.overview.title")} description={t("teacher.overview.lead")} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TaskCard
          title={t("teacher.overview.pendingReview")}
          value={pendingReview}
          hint={t("teacher.overview.pendingReviewHint")}
          href="/teacher/bank/questions?status=PENDING_REVIEW"
          actionLabel={t("teacher.overview.openBank")}
          empty={pendingReview === 0}
          emptyLabel={t("teacher.overview.noPendingReview")}
        />
        <TaskCard
          title={t("teacher.overview.needsGrading")}
          value={needsGrading}
          hint={t("teacher.overview.needsGradingHint")}
          href="/teacher/scores"
          actionLabel={t("teacher.overview.openScores")}
          empty={needsGrading === 0}
          emptyLabel={t("teacher.overview.noNeedsGrading")}
        />
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("teacher.overview.subjects")}</CardDescription>
            <CardTitle className="font-serif text-3xl">{subjects.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {subjects.length === 0 ? (
              <p>{t("teacher.overview.noSubjects")}</p>
            ) : (
              <ul className="space-y-1">
                {subjects.slice(0, 3).map((subject) => (
                  <li key={subject.id}>
                    {subject.code} — {subject.name}
                  </li>
                ))}
                {subjects.length > 3 ? (
                  <li className="text-xs">
                    {t("teacher.overview.moreSubjects", { count: String(subjects.length - 3) })}
                  </li>
                ) : null}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="font-serif text-xl">{t("teacher.overview.quickActions")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-4">
            <Link
              href="/teacher/tests"
              className={cn(buttonVariants({ variant: "outline" }), "justify-between")}
            >
              {t("teacher.overview.actionStartExam")}
              <ArrowRightIcon className="size-4" />
            </Link>
            <Link
              href="/teacher/bank"
              className={cn(buttonVariants({ variant: "outline" }), "justify-between")}
            >
              {t("teacher.overview.actionManageBank")}
              <ArrowRightIcon className="size-4" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="font-serif text-xl">{t("teacher.overview.recentResults")}</CardTitle>
            <CardDescription>{t("teacher.overview.recentResultsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {recentAttempts.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">{t("teacher.overview.noResults")}</p>
            ) : (
              <ul className="divide-y">
                {recentAttempts.map((row) => (
                  <li key={row.id} className="flex flex-col gap-1 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{row.examTitle}</p>
                      <p className="text-sm text-muted-foreground">{row.studentName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        label={formatAttemptStatus(row.status, labels.attemptStatus)}
                        variant={attemptStatusVariant(row.status)}
                      />
                      <span className="text-sm tabular-nums">
                        {row.score != null ? row.score : "—"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {scores.length > 0 ? (
              <div className="border-t px-6 py-3">
                <Link
                  href="/teacher/scores"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  {t("teacher.overview.viewAllScores")}
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function TaskCard({
  title,
  value,
  hint,
  href,
  actionLabel,
  empty,
  emptyLabel,
}: {
  title: string;
  value: number;
  hint: string;
  href: string;
  actionLabel: string;
  empty: boolean;
  emptyLabel: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="font-serif text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{empty ? emptyLabel : hint}</p>
        {!empty ? (
          <Link href={href} className={cn(buttonVariants({ size: "sm" }))}>
            {actionLabel}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
