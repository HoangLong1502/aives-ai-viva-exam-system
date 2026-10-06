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

const BLOOM = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE"] as const;

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
  const [bloom, setBloom] = useState<(typeof BLOOM)[number]>("UNDERSTAND");
  const [count, setCount] = useState(3);
  const [selected, setSelected] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Question | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [materialCount, setMaterialCount] = useState<number | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function reload() {
    const [nextSubjects, nextRubrics, nextQuestions] = await Promise.all([
      api<Subject[]>("/api/teaching/subjects", { auth: true }),
      api<TeachingRubric[]>("/api/teaching/rubrics", { auth: true }),
      api<Question[]>("/api/teaching/questions", { auth: true }),
    ]);
    setSubjects(nextSubjects);
    setRubrics(nextRubrics);
    setQuestions(nextQuestions);
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
    ])
      .then(([nextSubjects, nextRubrics, nextQuestions]) => {
        if (cancelled) return;
        setSubjects(nextSubjects);
        setRubrics(nextRubrics);
        setQuestions(nextQuestions);
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

  useEffect(() => {
    setRubricId((current) => resolveRubricIdForSubject(rubrics, subjectId, current));
  }, [rubrics, subjectId]);

  useEffect(() => {
    if (!subjectId) {
      setMaterialCount(null);
      return;
    }
    let cancelled = false;
    api<{ id: string }[]>(`/api/teaching/documents?subjectId=${subjectId}`, { auth: true })
      .then((docs) => {
        if (!cancelled) setMaterialCount(docs.length);
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
    const activeRubricId = resolveRubricIdForSubject(rubrics, subjectId, rubricId);
    if (!activeRubricId) {
      const message = t("teacher.tests.chooseSubjectRubric");
      setGenerateError(message);
      toast.error(message);
      return;
    }
    if (materialCount === 0) {
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
    setStarting(true);
    try {
      await api("/api/teaching/exams", {
        method: "POST",
        auth: true,
        body: { title, format, subjectId, questionIds: selected },
      });
      setTitle("");
      setSelected([]);
      toast.success(t("teacher.tests.sessionStarted"));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("teacher.tests.loadError"));
    } finally {
      setStarting(false);
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
          {materialCount === 0 && subjectId ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              {t("teacher.tests.noMaterialForSubject")}{" "}
              <Link href="/teacher/bank" className="font-medium underline underline-offset-2">
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
                  setSubjectId(event.target.value);
                  setSelected([]);
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
                rubricId={rubricId}
                label={t("teacher.common.rubric")}
                hint={t("teacher.rubrics.editLink")}
                returnTo="/teacher/tests"
              />
              <select
                id="draft-rubric"
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                value={rubricId}
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
                materialCount !== null && materialCount === 0
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
                    setSubjectId(event.target.value);
                    setSelected([]);
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
    </div>
  );
}
