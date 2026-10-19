"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { TeacherPageHeader } from "@/components/teacher/page-header";
import { StatusBadge } from "@/components/teacher/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";

type CourseRow = {
  id: string;
  code: string;
  name: string;
  examCount: number;
  submittedCount: number;
  pendingCount: number;
};

type ExamRow = {
  id: string;
  title: string;
  status: string;
  format: string;
  participantCount: number;
  submittedCount: number;
  pendingCount: number;
  averageScore: number | null;
};

type Participant = {
  attemptId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  status: string;
  score: number | null;
  answeredCount: number;
  gradedCount: number;
};

type ExamParticipants = {
  examId: string;
  examTitle: string;
  courseId: string;
  courseName: string;
  submittedCount: number;
  gradedCount: number;
  averageScore: number | null;
  participants: Participant[];
};

type TurnRow = {
  turnId: string;
  turnNo: number;
  turnType: string;
  questionText: string;
  transcript: string;
  answered: boolean;
  aiScore: number | null;
  aiFeedback: string | null;
  evaluator: string | null;
};

type QuestionRow = {
  questionId: string;
  number: number;
  prompt: string;
  expectedAnswer: string | null;
  keyPoints: string | null;
  answered: boolean;
  aiScore: number | null;
  teacherScore: number | null;
  teacherFeedback: string | null;
  turns: TurnRow[];
};

type AttemptGrading = {
  attemptId: string;
  examId: string;
  examTitle: string;
  courseId: string;
  courseName: string;
  studentName: string;
  studentCode: string;
  status: string;
  score: number | null;
  pointsPerQuestion: number;
  questions: QuestionRow[];
};

function useTeachingData<T>(path: string) {
  const { t } = useLocale();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<T>(path, { auth: true })
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.message : t("teacher.grading.loadError"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, t, version]);

  const reload = useCallback(async () => setVersion((current) => current + 1), []);

  return { data, loading, reload };
}

function LoadingCard() {
  const { t } = useLocale();
  return (
    <Card>
      <CardContent className="flex justify-center py-12">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-label={t("teacher.common.loading")} />
      </CardContent>
    </Card>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="px-6 py-10 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}

function PendingBadge({ count }: { count: number }) {
  const { t } = useLocale();
  return count > 0 ? (
    <StatusBadge label={t("teacher.grading.pending", { count: String(count) })} variant="warning" />
  ) : (
    <StatusBadge label={t("teacher.grading.allGraded")} variant="success" />
  );
}

function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/50"
      >
        {children}
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

function formatScore(value: number | null, digits = 1) {
  const factor = 10 ** digits;
  return value == null ? "—" : String(Math.round(value * factor) / factor);
}

export function GradingCoursesView() {
  const { t } = useLocale();
  const { data, loading } = useTeachingData<CourseRow[]>("/api/teaching/grading/courses");

  return (
    <div className="space-y-6">
      <TeacherPageHeader
        eyebrow={t("teacher.scores.eyebrow")}
        title={t("teacher.grading.coursesTitle")}
        description={t("teacher.grading.coursesLead")}
        breadcrumbs={[
          { href: "/teacher", label: t("nav.teacher.overview") },
          { label: t("nav.teacher.scores") },
        ]}
      />
      {loading ? (
        <LoadingCard />
      ) : !data || data.length === 0 ? (
        <EmptyCard text={t("teacher.grading.noCourses")} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {data.map((course) => (
                <RowLink key={course.id} href={`/teacher/scores/${course.id}`}>
                  <div className="space-y-1">
                    <p className="font-medium">{course.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {course.code} · {t("teacher.grading.examCount", { count: String(course.examCount) })} ·{" "}
                      {t("teacher.grading.submittedCount", { count: String(course.submittedCount) })}
                    </p>
                  </div>
                  <PendingBadge count={course.pendingCount} />
                </RowLink>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function GradingExamsView({ courseId }: { courseId: string }) {
  const { t } = useLocale();
  const courses = useTeachingData<CourseRow[]>("/api/teaching/grading/courses");
  const exams = useTeachingData<ExamRow[]>(`/api/teaching/grading/courses/${courseId}/exams`);
  const course = courses.data?.find((item) => item.id === courseId);

  return (
    <div className="space-y-6">
      <TeacherPageHeader
        eyebrow={t("teacher.scores.eyebrow")}
        title={course?.name ?? t("teacher.grading.examsTitle")}
        description={t("teacher.grading.examsLead")}
        breadcrumbs={[
          { href: "/teacher", label: t("nav.teacher.overview") },
          { href: "/teacher/scores", label: t("nav.teacher.scores") },
          { label: course?.name ?? t("teacher.grading.examsTitle") },
        ]}
      />
      {exams.loading ? (
        <LoadingCard />
      ) : !exams.data || exams.data.length === 0 ? (
        <EmptyCard text={t("teacher.grading.noExams")} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {exams.data.map((exam) => (
                <RowLink key={exam.id} href={`/teacher/scores/${courseId}/${exam.id}`}>
                  <div className="space-y-1">
                    <p className="font-medium">{exam.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("teacher.grading.participantCount", { count: String(exam.participantCount) })} ·{" "}
                      {t("teacher.grading.submittedCount", { count: String(exam.submittedCount) })} ·{" "}
                      {t("teacher.grading.average", { score: formatScore(exam.averageScore) })}
                    </p>
                  </div>
                  <PendingBadge count={exam.pendingCount} />
                </RowLink>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function GradingParticipantsView({ courseId, examId }: { courseId: string; examId: string }) {
  const { t } = useLocale();
  const { data, loading } = useTeachingData<ExamParticipants>(
    `/api/teaching/grading/exams/${examId}/participants`,
  );

  return (
    <div className="space-y-6">
      <TeacherPageHeader
        eyebrow={t("teacher.scores.eyebrow")}
        title={data?.examTitle ?? t("teacher.grading.participantsTitle")}
        description={t("teacher.grading.participantsLead")}
        breadcrumbs={[
          { href: "/teacher", label: t("nav.teacher.overview") },
          { href: "/teacher/scores", label: t("nav.teacher.scores") },
          { href: `/teacher/scores/${courseId}`, label: data?.courseName ?? t("teacher.grading.examsTitle") },
          { label: data?.examTitle ?? t("teacher.grading.participantsTitle") },
        ]}
      />
      {loading ? (
        <LoadingCard />
      ) : !data || data.participants.length === 0 ? (
        <EmptyCard text={t("teacher.grading.noParticipants")} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label={t("teacher.grading.statSubmitted")} value={String(data.submittedCount)} />
            <Stat label={t("teacher.grading.statGraded")} value={`${data.gradedCount}/${data.submittedCount}`} />
            <Stat label={t("teacher.grading.statAverage")} value={formatScore(data.averageScore)} />
          </div>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {data.participants.map((participant) => {
                  const submitted = participant.status === "SUBMITTED";
                  const done = participant.answeredCount > 0 && participant.gradedCount >= participant.answeredCount;
                  return (
                    <RowLink
                      key={participant.attemptId}
                      href={`/teacher/scores/${courseId}/${examId}/${participant.attemptId}`}
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{participant.studentName}</p>
                        <p className="text-sm text-muted-foreground">
                          {participant.studentCode ? `${participant.studentCode} · ` : ""}
                          {t("teacher.grading.gradedProgress", {
                            graded: String(participant.gradedCount),
                            total: String(participant.answeredCount),
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {!submitted ? (
                          <StatusBadge label={t("teacher.grading.notSubmitted")} variant="neutral" />
                        ) : done ? (
                          <StatusBadge label={t("teacher.grading.allGraded")} variant="success" />
                        ) : (
                          <StatusBadge label={t("teacher.grading.needsGrading")} variant="warning" />
                        )}
                        <span className="w-12 text-right font-serif text-2xl tabular-nums">
                          {formatScore(participant.score)}
                        </span>
                      </div>
                    </RowLink>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-serif text-2xl tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export function GradingAttemptView({
  courseId,
  examId,
  attemptId,
}: {
  courseId: string;
  examId: string;
  attemptId: string;
}) {
  const { t } = useLocale();
  const { data, loading, reload } = useTeachingData<AttemptGrading>(
    `/api/teaching/grading/attempts/${attemptId}`,
  );

  return (
    <div className="space-y-6">
      <TeacherPageHeader
        eyebrow={t("teacher.scores.eyebrow")}
        title={data?.studentName ?? t("teacher.grading.attemptTitle")}
        description={data ? `${data.examTitle}${data.studentCode ? ` · ${data.studentCode}` : ""}` : undefined}
        action={
          data ? (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{t("teacher.grading.finalScore")}</p>
              <p className="font-serif text-3xl tabular-nums">{formatScore(data.score)}</p>
            </div>
          ) : undefined
        }
        breadcrumbs={[
          { href: "/teacher", label: t("nav.teacher.overview") },
          { href: "/teacher/scores", label: t("nav.teacher.scores") },
          { href: `/teacher/scores/${courseId}`, label: data?.courseName ?? t("teacher.grading.examsTitle") },
          { href: `/teacher/scores/${courseId}/${examId}`, label: data?.examTitle ?? t("teacher.grading.participantsTitle") },
          { label: data?.studentName ?? t("teacher.grading.attemptTitle") },
        ]}
      />
      {loading ? (
        <LoadingCard />
      ) : !data || data.questions.length === 0 ? (
        <EmptyCard text={t("teacher.grading.noAnswers")} />
      ) : (
        <div className="space-y-4">
          {data.questions.map((question) => (
            <QuestionCard
              key={question.questionId}
              question={question}
              attemptId={data.attemptId}
              maxPoints={data.pointsPerQuestion}
              onSaved={reload}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  attemptId,
  maxPoints,
  onSaved,
}: {
  question: QuestionRow;
  attemptId: string;
  maxPoints: number;
  onSaved: () => Promise<void>;
}) {
  const { t } = useLocale();
  const toPoints = (percent: number) => (percent * maxPoints) / 100;
  const initial = question.teacherScore ?? question.aiScore;
  const [score, setScore] = useState(initial == null ? "" : formatScore(toPoints(initial), 2));
  const [feedback, setFeedback] = useState(question.teacherFeedback ?? "");
  const [saving, setSaving] = useState(false);
  const max = formatScore(maxPoints, 2);

  async function save() {
    const value = Number(score);
    if (score.trim() === "" || Number.isNaN(value) || value < 0 || value > maxPoints) {
      toast.error(t("teacher.grading.scoreInvalid", { max }));
      return;
    }
    setSaving(true);
    try {
      await api(`/api/teaching/grading/attempts/${attemptId}/questions/${question.questionId}`, {
        method: "PUT",
        auth: true,
        body: { score: value, feedback },
      });
      toast.success(t("teacher.grading.saved"));
      await onSaved();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("teacher.grading.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">
            {t("teacher.grading.questionHeading", { number: String(question.number), max })}
          </h2>
          {question.teacherScore != null ? (
            <StatusBadge label={t("teacher.grading.gradedByTeacher")} variant="success" />
          ) : question.answered ? (
            <StatusBadge label={t("teacher.grading.needsGrading")} variant="warning" />
          ) : (
            <StatusBadge label={t("teacher.grading.notAnswered")} variant="neutral" />
          )}
        </div>
        <p>{question.prompt}</p>

        {question.turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("teacher.grading.unanswered")}</p>
        ) : (
          <ul className="space-y-3">
            {question.turns.map((turn) => (
              <li key={turn.turnId} className="space-y-1 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={t(turn.turnType === "FOLLOW_UP" ? "teacher.grading.followUp" : "teacher.grading.mainQuestion")}
                    variant={turn.turnType === "FOLLOW_UP" ? "info" : "neutral"}
                  />
                  {turn.turnType === "FOLLOW_UP" ? (
                    <span className="text-sm text-muted-foreground">{turn.questionText}</span>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                  {turn.answered && turn.transcript ? turn.transcript : t("teacher.grading.noTranscript")}
                </p>
                {turn.aiScore != null ? (
                  <p className="text-xs text-muted-foreground">
                    {t("teacher.grading.aiSuggestion", { score: formatScore(toPoints(turn.aiScore), 2), max })}
                    {turn.evaluator === "RULE_BASED" ? ` (${t("teacher.grading.provisional")})` : ""}
                    {turn.aiFeedback ? ` — ${turn.aiFeedback}` : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{t("teacher.grading.modelAnswer")}</p>
          <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">{question.expectedAnswer || "—"}</p>
          {question.keyPoints ? (
            <p className="whitespace-pre-wrap text-xs text-muted-foreground">
              {t("teacher.grading.keyPoints")}: {question.keyPoints}
            </p>
          ) : null}
        </div>

        {question.answered ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`score-${question.questionId}`}>
                {t("teacher.grading.pointsLabel", { max })}
              </label>
              <Input
                id={`score-${question.questionId}`}
                className="w-28"
                inputMode="decimal"
                value={score}
                onChange={(event) => setScore(event.target.value)}
                placeholder={`0–${max}`}
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`note-${question.questionId}`}>
                {t("teacher.grading.comment")}
              </label>
              <Input
                id={`note-${question.questionId}`}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder={t("teacher.grading.commentPlaceholder")}
              />
            </div>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? t("teacher.common.loading") : t("teacher.common.save")}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
