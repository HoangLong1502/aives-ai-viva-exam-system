"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/teacher/confirm-dialog";
import { RubricFieldLabel } from "@/components/teacher/rubric-field-label";
import { TeacherPageHeader } from "@/components/teacher/page-header";
import { StatusBadge, questionStatusVariant } from "@/components/teacher/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import { formatBloom, formatExamFormat, formatQuestionStatus } from "@/lib/teacher/labels";
import {
  resolveRubricIdForSubject,
  rubricsForSubject,
  type TeachingRubric,
} from "@/lib/teacher/rubrics";

type Subject = { id: string; name: string; code: string };
type TeacherExam = {
  id: string;
  title: string;
  format: string;
  status: string;
  subjectId: string;
  subjectName: string;
  questionCount: number;
  durationMinutes: number | null;
  maxFollowUps: number;
  answerTimeLimitSec: number;
};
type Question = {
  id: string;
  subjectId: string;
  prompt: string;
  status: string;
  bloom: string;
  topic: string;
  source: string;
  sourceRef: string | null;
  expectedAnswer: string | null;
  keyPoints: string | null;
};

const BLOOM = ["EASY", "MEDIUM", "HARD"] as const;

export function TeacherTests() {
  const searchParams = useSearchParams();
  const { t, locale, messages } = useLocale();
  const labels = messages.teacher.labels;
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rubrics, setRubrics] = useState<TeachingRubric[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [rubricId, setRubricId] = useState("");
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState("ORAL");
  const [topic, setTopic] = useState("Oral reasoning");
  const [bloom, setBloom] = useState<(typeof BLOOM)[number]>("EASY");
  const [count, setCount] = useState(3);
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [answerTimeLimitSec, setAnswerTimeLimitSec] = useState("120");
  const [maxFollowUps, setMaxFollowUps] = useState("2");
  const [selected, setSelected] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Question | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [materialCount, setMaterialCount] = useState<number | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [exams, setExams] = useState<TeacherExam[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busyExamId, setBusyExamId] = useState<string | null>(null);
  const [deleteExam, setDeleteExam] = useState<TeacherExam | null>(null);

  function applyExams(next: TeacherExam[]) {
    setExams(next);
    setNames(Object.fromEntries(next.map((exam) => [exam.id, exam.title])));
  }

  async function reload() {
    const [nextSubjects, nextRubrics, nextQuestions, nextExams] = await Promise.all([
      api<Subject[]>("/api/teaching/subjects", { auth: true }),
      api<TeachingRubric[]>("/api/teaching/rubrics", { auth: true }),
      api<Question[]>("/api/teaching/questions", { auth: true }),
      api<TeacherExam[]>("/api/teaching/exams", { auth: true }),
    ]);
    setSubjects(nextSubjects);
    setRubrics(nextRubrics);
    setQuestions(nextQuestions);
    applyExams(nextExams);
    setSubjectId((current) => current || nextSubjects[0]?.id || "");
    setRubricId((current) =>
      resolveRubricIdForSubject(nextRubrics, subjectId || nextSubjects[0]?.id || "", current),
    );
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<Subject[]>("/api/teaching/subjects", { auth: true }),
      api<TeachingRubric[]>("/api/teaching/rubrics", { auth: true }),
      api<Question[]>("/api/teaching/questions", { auth: true }),
      api<TeacherExam[]>("/api/teaching/exams", { auth: true }),
    ])
      .then(([nextSubjects, nextRubrics, nextQuestions, nextExams]) => {
        if (cancelled) return;
        setSubjects(nextSubjects);
        setRubrics(nextRubrics);
        setQuestions(nextQuestions);
        applyExams(nextExams);
        const fromUrl = searchParams.get("subjectId");
        const validFromUrl =
          fromUrl && nextSubjects.some((subject) => subject.id === fromUrl) ? fromUrl : null;
        setSubjectId((current) => current || validFromUrl || nextSubjects[0]?.id || "");
        setRubricId((current) =>
          resolveRubricIdForSubject(
            nextRubrics,
            validFromUrl || nextSubjects[0]?.id || "",
            current,
          ),
        );
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.message : t("teacher.tests.loadError"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t, searchParams]);

  useEffect(() => {
    if (loading || typeof window === "undefined") return;
    if (window.location.hash !== "#draft-from-ai") return;
    document.getElementById("draft-from-ai")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading]);

  const subjectRubrics = useMemo(
    () => rubricsForSubject(rubrics, subjectId),
    [rubrics, subjectId],
  );
  const effectiveRubricId = resolveRubricIdForSubject(rubrics, subjectId, rubricId) ?? "";
  const effectiveMaterialCount = subjectId ? materialCount : null;

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    api<{ id: string; status: string }[]>(`/api/teaching/documents?subjectId=${subjectId}`, { auth: true })
      .then((docs) => {
        // Materials still processing (or failed) cannot be used for drafting yet.
        if (!cancelled) setMaterialCount(docs.filter((doc) => doc.status === "DONE").length);
      })
      .catch(() => {
        if (!cancelled) setMaterialCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  const forSubject = useMemo(
    () => questions.filter((question) => !subjectId || question.subjectId === subjectId),
    [questions, subjectId],
  );
  const pending = forSubject.filter((question) => question.status === "PENDING_REVIEW");
  const approved = forSubject.filter((question) => question.status === "APPROVED");

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function onGenerate() {
    setGenerateError(null);
    if (!subjectId) {
      const message = t("teacher.tests.chooseSubjectRubric");
      setGenerateError(message);
      toast.error(message);
      return;
    }
    if (subjectRubrics.length === 0) {
      const message = t("teacher.tests.noRubricForSubject");
      setGenerateError(message);
      toast.error(message);
      return;
    }
    const activeRubricId = effectiveRubricId;
    if (!activeRubricId) {
      const message = t("teacher.tests.chooseSubjectRubric");
      setGenerateError(message);
      toast.error(message);
      return;
    }
    if (effectiveMaterialCount === 0) {
      const message = t("teacher.tests.noMaterialForSubject");
      setGenerateError(message);
      toast.error(message);
      return;
    }
    const boundedCount = Math.min(10, Math.max(1, Number(count) || 1));
    if (boundedCount !== count) setCount(boundedCount);
    if (!topic.trim()) {
      const message = t("teacher.common.topic");
      setGenerateError(message);
      toast.error(message);
      return;
    }
    setGenerating(true);
    try {
      const created = await api<Question[]>("/api/teaching/questions/generate", {
        method: "POST",
        auth: true,
        body: {
          subjectId,
          rubricId: activeRubricId,
          topic: topic.trim(),
          bloom,
          count: boundedCount,
        },
      });
      toast.success(t("teacher.tests.draftsReady", { count: String(created.length) }));
      await reload();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("teacher.tests.loadError");
      setGenerateError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }

  async function review(question: Question, status: string) {
    const nextPrompt = edits[question.id] ?? question.prompt;
    try {
      const updated = await api<Question>(`/api/teaching/questions/${question.id}`, {
        method: "PATCH",
        auth: true,
        body: { prompt: nextPrompt, bloom: question.bloom, status },
      });
      setQuestions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEdits((current) => {
        const next = { ...current };
        delete next[question.id];
        return next;
      });
      if (status === "APPROVED") {
        setSelected((current) => (current.includes(updated.id) ? current : [...current, updated.id]));
      }
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("teacher.tests.loadError"));
      return false;
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setRejecting(true);
    const ok = await review(rejectTarget, "REJECTED");
    setRejecting(false);
    if (ok) setRejectTarget(null);
  }

  async function onStart(event: FormEvent) {
    event.preventDefault();
    if (selected.length === 0) {
      toast.error(t("teacher.tests.selectQuestion"));
      return;
    }
    const minutes = Number(durationMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
      toast.error(t("teacher.tests.durationInvalid"));
      return;
    }
    const answerSeconds = Number(answerTimeLimitSec);
    if (!Number.isInteger(answerSeconds) || (answerSeconds !== 0 && (answerSeconds < 15 || answerSeconds > 1800))) {
      toast.error(t("teacher.tests.answerTimeInvalid"));
      return;
    }
    const followUps = Number(maxFollowUps);
    if (!Number.isInteger(followUps) || followUps < 0 || followUps > 5) {
      toast.error(t("teacher.tests.maxFollowUpsInvalid"));
      return;
    }
    setStarting(true);
    try {
      await api("/api/teaching/exams", {
        method: "POST",
        auth: true,
        body: {
          title,
          format,
          subjectId,
          questionIds: selected,
          durationMinutes: minutes,
          answerTimeLimitSec: answerSeconds,
          maxFollowUps: followUps,
        },
      });
      setTitle("");
      setSelected([]);
      applyExams(await api<TeacherExam[]>("/api/teaching/exams", { auth: true }));
      toast.success(t("teacher.tests.sessionStarted"));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("teacher.tests.loadError"));
    } finally {
      setStarting(false);
    }
  }

  async function saveExamName(exam: TeacherExam) {
    const title = (names[exam.id] ?? exam.title).trim();
    if (!title) return;
    setBusyExamId(exam.id);
    try {
      await api(`/api/teaching/exams/${exam.id}`, { method: "PATCH", auth: true, body: { title } });
      applyExams(await api<TeacherExam[]>("/api/teaching/exams", { auth: true }));
      toast.success(t("teacher.tests.renamed"));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("teacher.tests.loadError"));
    } finally {
      setBusyExamId(null);
    }
  }

  async function setExamStatus(exam: TeacherExam, status: "IN_PROGRESS" | "COMPLETED") {
    setBusyExamId(exam.id);
    try {
      await api(`/api/teaching/exams/${exam.id}/status`, { method: "PATCH", auth: true, body: { status } });
      applyExams(await api<TeacherExam[]>("/api/teaching/exams", { auth: true }));
      toast.success(status === "COMPLETED" ? t("teacher.tests.sessionClosed") : t("teacher.tests.sessionReopened"));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("teacher.tests.loadError"));
    } finally {
      setBusyExamId(null);
    }
  }

  async function confirmDeleteExam() {
    if (!deleteExam) return;
    setBusyExamId(deleteExam.id);
    try {
      await api(`/api/teaching/exams/${deleteExam.id}`, { method: "DELETE", auth: true });
      applyExams(await api<TeacherExam[]>("/api/teaching/exams", { auth: true }));
      toast.success(t("teacher.tests.sessionDeleted"));
      setDeleteExam(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("teacher.tests.loadError"));
    } finally {
      setBusyExamId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-label={t("teacher.common.loading")} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TeacherPageHeader
        eyebrow={t("teacher.tests.eyebrow")}
        title={t("teacher.tests.title")}
        description={t("teacher.tests.lead")}
        breadcrumbs={[
          { href: "/teacher", label: t("nav.teacher.overview") },
          { label: t("nav.teacher.exams") },
        ]}
      />

      <Card id="draft-from-ai">
        <CardHeader className="border-b">
          <CardTitle className="font-serif text-2xl">{t("teacher.tests.draftTitle")}</CardTitle>
          <CardDescription>{t("teacher.tests.draftDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {generateError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {generateError}
            </p>
          ) : null}
          {effectiveMaterialCount === 0 && subjectId ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              {t("teacher.tests.noMaterialForSubject")}{" "}
              <Link href="/teacher/subjects" className="font-medium underline underline-offset-2">
                {t("teacher.tests.importMaterialLink")}
              </Link>
            </p>
          ) : null}
          {subjectId && subjectRubrics.length === 0 ? (
            <p className="rounded-lg border px-3 py-2 text-sm text-muted-foreground" role="status">
              {t("teacher.tests.noRubricForSubject")}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{t("teacher.tests.generateHint")}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="draft-subject">{t("teacher.common.subject")}</FieldLabel>
              <select
                id="draft-subject"
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                value={subjectId}
                onChange={(event) => {
                  const nextSubjectId = event.target.value;
                  setSubjectId(nextSubjectId);
                  setSelected([]);
                  setRubricId((current) => resolveRubricIdForSubject(rubrics, nextSubjectId, current));
                }}
              >
                {subjects.length === 0 ? (
                  <option value="">{t("teacher.tests.noSubjects")}</option>
                ) : null}
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} — {subject.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <RubricFieldLabel
                htmlFor="draft-rubric"
                subjectId={subjectId}
                rubricId={effectiveRubricId}
                label={t("teacher.common.rubric")}
                hint={t("teacher.rubrics.editLink")}
                returnTo="/teacher/tests"
              />
              <select
                id="draft-rubric"
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                value={effectiveRubricId}
                onChange={(event) => setRubricId(event.target.value)}
              >
                {subjectRubrics.length === 0 ? (
                  <option value="">{t("teacher.tests.noRubricForSubject")}</option>
                ) : null}
                {subjectRubrics.map((rubric) => (
                  <option key={rubric.id} value={rubric.id}>
                    {rubric.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="draft-topic">{t("teacher.common.topic")}</FieldLabel>
              <Input id="draft-topic" value={topic} onChange={(event) => setTopic(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="draft-bloom">{t("teacher.common.bloom")}</FieldLabel>
              <select
                id="draft-bloom"
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                value={bloom}
                onChange={(event) => setBloom(event.target.value as (typeof BLOOM)[number])}
              >
                {BLOOM.map((level) => (
                  <option key={level} value={level}>
                    {formatBloom(level, locale)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Button
              type="button"
              onClick={() => void onGenerate()}
              disabled={
                generating ||
                !subjectId ||
                subjectRubrics.length === 0 ||
                effectiveMaterialCount !== null && effectiveMaterialCount === 0
              }
            >
              {generating
                ? t("teacher.tests.drafting")
                : t("teacher.tests.draftButton", { count: String(count) })}
            </Button>
            <Field>
              <FieldLabel htmlFor="draft-count">{t("teacher.tests.draftCount")}</FieldLabel>
              <Input
                id="draft-count"
                className="w-24"
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              />
            </Field>
          </div>

          {pending.length > 0 ? (
            <ul className="divide-y rounded-xl border">
              {pending.map((question) => (
                <li key={question.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={formatQuestionStatus(question.status, labels.questionStatus)}
                      variant={questionStatusVariant(question.status)}
                    />
                    <StatusBadge label={formatBloom(question.bloom, locale)} variant="info" />
                    <span className="text-xs text-muted-foreground">{question.topic}</span>
                  </div>
                  <textarea
                    aria-label={t("teacher.common.prompt")}
                    value={edits[question.id] ?? question.prompt}
                    onChange={(event) =>
                      setEdits((current) => ({ ...current, [question.id]: event.target.value }))
                    }
                    className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  {(question.expectedAnswer || question.keyPoints) && (
                    <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("teacher.common.gradingBasis")}
                        {question.sourceRef ? ` · ${question.sourceRef}` : ""}
                      </p>
                      {question.expectedAnswer ? (
                        <p className="mt-1">
                          <span className="font-medium">{t("teacher.common.expectedAnswer")}: </span>
                          {question.expectedAnswer}
                        </p>
                      ) : null}
                      {question.keyPoints ? (
                        <p className="mt-1 text-muted-foreground">
                          <span className="font-medium text-foreground">{t("teacher.common.keyPoints")}: </span>
                          {question.keyPoints}
                        </p>
                      ) : null}
                    </div>
                  )}
                  {!question.expectedAnswer && !question.keyPoints ? (
                    <p className="text-xs text-muted-foreground">
                      {question.sourceRef ?? question.source}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => void review(question, "APPROVED")}>
                      {t("teacher.common.approve")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setRejectTarget(question)}
                    >
                      {t("teacher.common.reject")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="font-serif text-2xl">{t("teacher.tests.sessionTitle")}</CardTitle>
          <CardDescription>{t("teacher.tests.sessionDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form key={subjectId} className="space-y-4" onSubmit={onStart}>
            <Field>
              <FieldLabel htmlFor="session-title">{t("teacher.tests.sessionName")}</FieldLabel>
              <Input
                id="session-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("teacher.tests.sessionNamePlaceholder")}
                required
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="session-subject">{t("teacher.common.subject")}</FieldLabel>
                <select
                  id="session-subject"
                  className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                  value={subjectId}
                  onChange={(event) => {
                    const nextSubjectId = event.target.value;
                    setSubjectId(nextSubjectId);
                    setSelected([]);
                    setRubricId((current) => resolveRubricIdForSubject(rubrics, nextSubjectId, current));
                  }}
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code} — {subject.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="session-format">Format</FieldLabel>
                <select
                  id="session-format"
                  className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                  value={format}
                  onChange={(event) => setFormat(event.target.value)}
                >
                  <option value="ORAL">{formatExamFormat("ORAL", labels.examFormat)}</option>
                  <option value="MULTIPLE_CHOICE">
                    {formatExamFormat("MULTIPLE_CHOICE", labels.examFormat)}
                  </option>
                </select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="session-duration">{t("teacher.tests.duration")}</FieldLabel>
              <Input
                id="session-duration"
                type="number"
                min={1}
                max={600}
                className="w-32"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">{t("teacher.tests.durationHint")}</p>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="session-answer-time">{t("teacher.tests.answerTime")}</FieldLabel>
                <Input
                  id="session-answer-time"
                  type="number"
                  min={0}
                  max={1800}
                  className="w-32"
                  value={answerTimeLimitSec}
                  onChange={(event) => setAnswerTimeLimitSec(event.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">{t("teacher.tests.answerTimeHint")}</p>
              </Field>
              <Field>
                <FieldLabel htmlFor="session-follow-ups">{t("teacher.tests.maxFollowUps")}</FieldLabel>
                <Input
                  id="session-follow-ups"
                  type="number"
                  min={0}
                  max={5}
                  className="w-32"
                  value={maxFollowUps}
                  onChange={(event) => setMaxFollowUps(event.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">{t("teacher.tests.maxFollowUpsHint")}</p>
              </Field>
            </div>
            <ul className="space-y-2">
              {approved.length === 0 ? (
                <li className="text-sm text-muted-foreground">{t("teacher.tests.noApproved")}</li>
              ) : (
                approved.map((question) => (
                  <li key={question.id}>
                    <label className="flex items-start gap-2 rounded-lg border p-3 text-sm hover:bg-muted/40">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected.includes(question.id)}
                        onChange={() => toggle(question.id)}
                      />
                      <span>
                        <StatusBadge
                          label={formatBloom(question.bloom, locale)}
                          variant="info"
                          className="mb-1"
                        />
                        <br />
                        {question.prompt}
                      </span>
                    </label>
                  </li>
                ))
              )}
            </ul>
            <Button type="submit" disabled={!subjectId || selected.length === 0 || starting}>
              {starting ? t("teacher.common.loading") : t("teacher.tests.startTest")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="font-serif text-2xl">{t("teacher.tests.openSessions")}</CardTitle>
          <CardDescription>{t("teacher.tests.openSessionsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {exams.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("teacher.tests.noSessions")}</p>
          ) : (
            <ul className="space-y-3">
              {exams.map((exam) => (
                <li key={exam.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <StatusBadge
                      label={
                        exam.status === "IN_PROGRESS"
                          ? t("teacher.tests.statusInProgress")
                          : exam.status === "COMPLETED"
                            ? t("teacher.tests.statusCompleted")
                            : exam.status
                      }
                      variant={exam.status === "IN_PROGRESS" ? "info" : "neutral"}
                    />
                    <span className="text-muted-foreground">{exam.subjectName}</span>
                    <span className="text-muted-foreground">
                      {formatExamFormat(exam.format, labels.examFormat)}
                    </span>
                    <span className="text-muted-foreground">
                      {t("teacher.tests.questionsCount", { count: String(exam.questionCount) })}
                    </span>
                    {exam.durationMinutes ? (
                      <span className="text-muted-foreground">
                        {t("teacher.tests.durationMinutes", { count: String(exam.durationMinutes) })}
                      </span>
                    ) : null}
                    {exam.answerTimeLimitSec > 0 ? (
                      <span className="text-muted-foreground">
                        {t("teacher.tests.answerTimeSeconds", { count: String(exam.answerTimeLimitSec) })}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground">
                      {t("teacher.tests.followUpsCount", { count: String(exam.maxFollowUps) })}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      aria-label={t("teacher.tests.sessionName")}
                      value={names[exam.id] ?? exam.title}
                      onChange={(event) =>
                        setNames((current) => ({ ...current, [exam.id]: event.target.value }))
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busyExamId === exam.id}
                      onClick={() => void saveExamName(exam)}
                    >
                      {t("teacher.tests.rename")}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {exam.status === "IN_PROGRESS" ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busyExamId === exam.id}
                        onClick={() => void setExamStatus(exam, "COMPLETED")}
                      >
                        {t("teacher.tests.closeSession")}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busyExamId === exam.id}
                        onClick={() => void setExamStatus(exam, "IN_PROGRESS")}
                      >
                        {t("teacher.tests.reopenSession")}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busyExamId === exam.id}
                      onClick={() => setDeleteExam(exam)}
                    >
                      {t("teacher.tests.deleteSession")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={rejectTarget != null}
        title={t("teacher.common.rejectConfirmTitle")}
        description={t("teacher.common.rejectConfirmDesc")}
        confirmLabel={t("teacher.common.rejectConfirmAction")}
        cancelLabel={t("teacher.common.cancel")}
        destructive
        confirming={rejecting}
        onCancel={() => {
          if (!rejecting) setRejectTarget(null);
        }}
        onConfirm={() => void confirmReject()}
      />
      <ConfirmDialog
        open={deleteExam != null}
        title={t("teacher.tests.deleteSessionTitle")}
        description={t("teacher.tests.deleteSessionDesc")}
        confirmLabel={t("teacher.tests.deleteSessionAction")}
        cancelLabel={t("teacher.common.cancel")}
        destructive
        confirming={deleteExam != null && busyExamId === deleteExam.id}
        onCancel={() => {
          if (busyExamId == null) setDeleteExam(null);
        }}
        onConfirm={() => void confirmDeleteExam()}
      />
    </div>
  );
}