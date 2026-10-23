"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, MessageSquareQuoteIcon } from "lucide-react";
import { ErrorState, LoadingSkeleton, PageHeader } from "@/components/admin/ui/dashboard-ui";
import { StatusBadge } from "@/components/teacher/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";

type Turn = {
  turnId: string;
  turnNo: number;
  turnType: "MAIN" | "FOLLOW_UP";
  questionText: string;
  transcript: string;
  answered: boolean;
  aiScore: number | null;
  aiFeedback: string | null;
};

type ReviewQuestion = {
  questionId: string;
  number: number;
  prompt: string;
  answered: boolean;
  aiScore: number | null;
  teacherScore: number | null;
  teacherFeedback: string | null;
  turns: Turn[];
};

type Review = {
  attemptId: string;
  examTitle: string;
  courseName: string;
  score: number | null;
  pointsPerQuestion: number;
  questions: ReviewQuestion[];
};

/** Scores are stored 0-100 per question; the exam shares 100 points across its questions. */
function points(score: number | null, perQuestion: number) {
  if (score == null) return null;
  return Math.round((score / 100) * perQuestion * 10) / 10;
}

export function StudentAttemptReview({ attemptId }: { attemptId: string }) {
  const { t } = useLocale();
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api<Review>(`/api/student/attempts/${attemptId}`, { auth: true, signal: controller.signal, cache: "no-store" })
      .then((value) => {
        if (controller.signal.aborted) return;
        setReview(value);
        setError(null);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof ApiError ? reason.message : t("student.review.loadError"));
      });
    return () => controller.abort();
  }, [attemptId, reloadKey, t]);

  const back = (
    <Button variant="outline" nativeButton={false} render={<Link href="/student/scores" />}>
      <ArrowLeftIcon />
      {t("student.review.back")}
    </Button>
  );

  if (error && !review) {
    return (
      <div className="space-y-6">
        {back}
        <ErrorState
          title={t("student.review.loadError")}
          message={error}
          retryLabel={t("student.review.retry")}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      </div>
    );
  }
  if (!review) {
    return <LoadingSkeleton className="h-96 w-full" label={t("student.review.loading")} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={review.courseName}
        title={review.examTitle}
        action={
          <div className="flex items-center gap-4">
            {back}
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{t("student.review.finalScore")}</p>
              <p className="font-serif text-4xl tabular-nums">{review.score ?? "—"}</p>
            </div>
          </div>
        }
      />

      <ol className="space-y-5">
        {review.questions.map((question) => {
          const graded = question.teacherScore != null;
          const earned = points(question.teacherScore ?? question.aiScore, review.pointsPerQuestion);
          return (
            <li key={question.questionId}>
              <Card>
                <CardHeader className="border-b">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("student.review.questionLabel", { number: String(question.number) })}
                      </p>
                      <CardTitle className="font-serif text-lg leading-snug">{question.prompt}</CardTitle>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge
                        label={
                          !question.answered
                            ? t("student.review.notAnswered")
                            : graded
                              ? t("student.review.teacherGraded")
                              : t("student.review.awaitingTeacher")
                        }
                        variant={!question.answered ? "neutral" : graded ? "success" : "warning"}
                      />
                      <p className="font-serif text-2xl tabular-nums">
                        {earned ?? "—"}
                        <span className="text-sm text-muted-foreground"> / {review.pointsPerQuestion}</span>
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {question.teacherFeedback ? (
                    <div className="flex gap-3 rounded-xl bg-highlight/15 p-4 ring-1 ring-highlight/40 ring-inset">
                      <MessageSquareQuoteIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("student.review.teacherComment")}
                        </p>
                        <p className="text-sm leading-relaxed">{question.teacherFeedback}</p>
                      </div>
                    </div>
                  ) : null}

                  {question.turns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("student.review.noAnswer")}</p>
                  ) : (
                    <div className="space-y-3">
                      {question.turns.map((turn) => (
                        <div key={turn.turnId} className="space-y-2">
                          {turn.turnType === "FOLLOW_UP" ? (
                            <Bubble role="examiner" label={t("student.review.followUp")} text={turn.questionText} />
                          ) : null}
                          <Bubble
                            role="student"
                            label={t("student.tests.you")}
                            text={turn.transcript.trim() || t("student.review.emptyAnswer")}
                          />
                          {turn.aiFeedback ? (
                            <Bubble role="examiner" label={t("student.tests.examiner")} text={turn.aiFeedback} />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Bubble({ role, label, text }: { role: "examiner" | "student"; label: string; text: string }) {
  return (
    <div className={`flex ${role === "student" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          role === "student" ? "bg-primary text-primary-foreground" : "border bg-card"
        }`}
      >
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
        {text}
      </div>
    </div>
  );
}
