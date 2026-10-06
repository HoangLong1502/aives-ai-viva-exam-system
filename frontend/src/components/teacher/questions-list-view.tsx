"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDownIcon, ChevronRightIcon, Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/teacher/confirm-dialog";
import { TeacherPageHeader } from "@/components/teacher/page-header";
import { StatusBadge, questionStatusVariant } from "@/components/teacher/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import { formatBloom, formatQuestionSource, formatQuestionStatus } from "@/lib/teacher/labels";
import { cn } from "cn";

type Subject = { id: string; code: string; name: string };
type Question = {
  id: string;
  subjectId: string;
  subjectName: string;
  topic: string;
  prompt: string;
  bloom: string;
  rubricName: string;
  criteria: string;
  maxScore: number;
  status: string;
  source: string;
  sourceRef: string | null;
  expectedAnswer: string | null;
  keyPoints: string | null;
};

type QuestionDraft = {
  topic: string;
  prompt: string;
  bloom: string;
  expectedAnswer: string;
  keyPoints: string;
};

const BLOOM = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE"] as const;

export function TeacherQuestionsListView() {
  const { t, locale, messages } = useLocale();
  const labels = messages.teacher.labels;
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(
    () => searchParams.get("subjectId"),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuestionDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const subjectParam = searchParams.get("subjectId");
    if (subjectParam) setExpandedSubjectId(subjectParam);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<Subject[]>("/api/teaching/subjects", { auth: true }),
      api<Question[]>("/api/teaching/questions", { auth: true }),
    ])
      .then(([nextSubjects, nextQuestions]) => {
        if (cancelled) return;
        setSubjects(nextSubjects);
        setQuestions(nextQuestions);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.message : t("teacher.bank.loadError"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const subjectsWithCounts = useMemo(
    () =>
      subjects
        .map((subject) => ({
          ...subject,
          count: questions.filter((question) => question.subjectId === subject.id).length,
        }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    [subjects, questions],
  );

  function questionsForSubject(subjectId: string) {
    return questions.filter((question) => question.subjectId === subjectId);
  }

  function startEdit(question: Question) {
    setEditingId(question.id);
    setDraft({
      topic: question.topic,
      prompt: question.prompt,
      bloom: question.bloom,
      expectedAnswer: question.expectedAnswer ?? "",
      keyPoints: question.keyPoints ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveEdit(question: Question) {
    if (!draft) return;
    const topic = draft.topic.trim();
    const prompt = draft.prompt.trim();
    if (!topic || !prompt) {
      toast.error(t("teacher.common.topic"));
      return;
    }
    setSaving(true);
    try {
      const updated = await api<Question>(`/api/teaching/questions/${question.id}`, {
        method: "PATCH",
        auth: true,
        body: {
          topic,
          prompt,
          bloom: draft.bloom,
          status: question.status,
          expectedAnswer: draft.expectedAnswer.trim(),
          keyPoints: draft.keyPoints.trim(),
        },
      });
      setQuestions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      cancelEdit();
      toast.success(t("teacher.bank.questionSaved"));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("teacher.bank.loadError"));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api<void>(`/api/teaching/questions/${deleteTarget.id}`, {
        method: "DELETE",
        auth: true,
      });
      setQuestions((current) => current.filter((item) => item.id !== deleteTarget.id));
      if (editingId === deleteTarget.id) cancelEdit();
      setDeleteTarget(null);
      toast.success(t("teacher.bank.questionDeleted"));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("teacher.bank.loadError"));
    } finally {
      setDeleting(false);
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
        eyebrow={t("teacher.bank.eyebrow")}
        title={t("teacher.bank.officialTitle")}
        description={t("teacher.bank.bySubjectDesc")}
        breadcrumbs={[
          { href: "/teacher", label: t("nav.teacher.overview") },
          { href: "/teacher/bank", label: t("nav.teacher.bank") },
          { label: t("teacher.bank.officialTitle") },
        ]}
        action={
          <Link href="/teacher/bank" className={cn(buttonVariants({ variant: "outline" }))}>
            {t("teacher.bank.backToBank")}
          </Link>
        }
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="font-serif text-xl">{t("teacher.bank.subjectCodesTitle")}</CardTitle>
          <CardDescription>{t("teacher.bank.subjectCodesDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {subjectsWithCounts.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              {t("teacher.bank.noSubjectsInList")}
            </p>
          ) : (
            <ul className="divide-y">
              {subjectsWithCounts.map((subject) => {
                const open = expandedSubjectId === subject.id;
                const subjectQuestions = questionsForSubject(subject.id);
                return (
                  <li key={subject.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40 sm:px-6"
                      aria-expanded={open}
                      onClick={() =>
                        setExpandedSubjectId((current) => (current === subject.id ? null : subject.id))
                      }
                    >
                      {open ? (
                        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="font-mono text-base font-semibold tracking-wide">{subject.code}</span>
                      <span className="ml-auto text-sm text-muted-foreground">
                        {t("teacher.bank.questionCount", { count: String(subject.count) })}
                      </span>
                    </button>

                    {open ? (
                      <div className="border-t bg-muted/20 px-4 py-4 sm:px-6">
                        {subjectQuestions.length === 0 ? (
                          <p className="py-4 text-sm text-muted-foreground">{t("teacher.bank.emptyForSubject")}</p>
                        ) : (
                          <ul className="space-y-3">
                            {subjectQuestions.map((question) => {
                              const isEditing = editingId === question.id && draft != null;
                              return (
                                <li
                                  key={question.id}
                                  className="rounded-xl border bg-background p-4 shadow-xs"
                                >
                                  <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <StatusBadge
                                      label={formatQuestionStatus(question.status, labels.questionStatus)}
                                      variant={questionStatusVariant(question.status)}
                                    />
                                    <StatusBadge
                                      label={formatQuestionSource(question.source, labels.questionSource)}
                                      variant="neutral"
                                    />
                                    <StatusBadge
                                      label={formatBloom(question.bloom, locale)}
                                      variant="info"
                                    />
                                  </div>

                                  {isEditing ? (
                                    <div className="space-y-3">
                                      <Field>
                                        <FieldLabel htmlFor={`topic-${question.id}`}>
                                          {t("teacher.common.topic")}
                                        </FieldLabel>
                                        <Input
                                          id={`topic-${question.id}`}
                                          value={draft.topic}
                                          onChange={(event) =>
                                            setDraft((current) =>
                                              current
                                                ? { ...current, topic: event.target.value }
                                                : current,
                                            )
                                          }
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`bloom-${question.id}`}>
                                          {t("teacher.common.bloom")}
                                        </FieldLabel>
                                        <select
                                          id={`bloom-${question.id}`}
                                          className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                                          value={draft.bloom}
                                          onChange={(event) =>
                                            setDraft((current) =>
                                              current
                                                ? { ...current, bloom: event.target.value }
                                                : current,
                                            )
                                          }
                                        >
                                          {BLOOM.map((level) => (
                                            <option key={level} value={level}>
                                              {formatBloom(level, locale)}
                                            </option>
                                          ))}
                                        </select>
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`prompt-${question.id}`}>
                                          {t("teacher.common.prompt")}
                                        </FieldLabel>
                                        <textarea
                                          id={`prompt-${question.id}`}
                                          value={draft.prompt}
                                          onChange={(event) =>
                                            setDraft((current) =>
                                              current
                                                ? { ...current, prompt: event.target.value }
                                                : current,
                                            )
                                          }
                                          className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`answer-${question.id}`}>
                                          {t("teacher.common.expectedAnswer")}
                                        </FieldLabel>
                                        <textarea
                                          id={`answer-${question.id}`}
                                          value={draft.expectedAnswer}
                                          onChange={(event) =>
                                            setDraft((current) =>
                                              current
                                                ? { ...current, expectedAnswer: event.target.value }
                                                : current,
                                            )
                                          }
                                          className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                        />
                                      </Field>
                                      <Field>
                                        <FieldLabel htmlFor={`keys-${question.id}`}>
                                          {t("teacher.common.keyPoints")}
                                        </FieldLabel>
                                        <Input
                                          id={`keys-${question.id}`}
                                          value={draft.keyPoints}
                                          onChange={(event) =>
                                            setDraft((current) =>
                                              current
                                                ? { ...current, keyPoints: event.target.value }
                                                : current,
                                            )
                                          }
                                        />
                                      </Field>
                                      <div className="flex flex-wrap gap-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          disabled={saving}
                                          onClick={() => void saveEdit(question)}
                                        >
                                          {saving ? t("teacher.common.loading") : t("teacher.common.save")}
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          disabled={saving}
                                          onClick={cancelEdit}
                                        >
                                          {t("teacher.common.cancel")}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="font-medium leading-6">{question.prompt}</p>
                                      <p className="mt-1 text-sm text-muted-foreground">
                                        {question.topic}
                                        {question.sourceRef ? ` · ${question.sourceRef}` : ""}
                                      </p>
                                      {(question.expectedAnswer || question.keyPoints) && (
                                        <div className="mt-3 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm">
                                          <p className="text-xs font-medium text-muted-foreground">
                                            {t("teacher.common.gradingBasis")}
                                          </p>
                                          {question.expectedAnswer ? (
                                            <p className="mt-1">
                                              <span className="font-medium">
                                                {t("teacher.common.expectedAnswer")}:{" "}
                                              </span>
                                              {question.expectedAnswer}
                                            </p>
                                          ) : null}
                                          {question.keyPoints ? (
                                            <p className="mt-1 text-muted-foreground">
                                              <span className="font-medium text-foreground">
                                                {t("teacher.common.keyPoints")}:{" "}
                                              </span>
                                              {question.keyPoints}
                                            </p>
                                          ) : null}
                                        </div>
                                      )}
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => startEdit(question)}
                                        >
                                          <PencilIcon className="size-3.5" />
                                          {t("teacher.bank.editQuestion")}
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => setDeleteTarget(question)}
                                        >
                                          <Trash2Icon className="size-3.5" />
                                          {t("teacher.bank.deleteQuestion")}
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteTarget != null}
        title={t("teacher.bank.deleteConfirmTitle")}
        description={t("teacher.bank.deleteConfirmDesc")}
        confirmLabel={t("teacher.bank.deleteConfirmAction")}
        cancelLabel={t("teacher.common.cancel")}
        destructive
        confirming={deleting}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
