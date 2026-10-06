"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { MaterialDropzone } from "@/components/teacher/material-dropzone";
import { RubricFieldLabel } from "@/components/teacher/rubric-field-label";
import { TeacherPageHeader } from "@/components/teacher/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import { formatBloom } from "@/lib/teacher/labels";
import {
  resolveRubricIdForSubject,
  rubricsForSubject,
  type TeachingRubric,
} from "@/lib/teacher/rubrics";

type Subject = { id: string; code: string; name: string };
type Rubric = TeachingRubric;
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
};

const BLOOM = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE"] as const;

export function TeacherBank() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [questionStats, setQuestionStats] = useState({ total: 0, pending: 0 });
  const [subjectId, setSubjectId] = useState("");
  const [rubricId, setRubricId] = useState("");
  const [topic, setTopic] = useState("Oral reasoning");
  const [bloom, setBloom] = useState<(typeof BLOOM)[number]>("UNDERSTAND");
  const [prompt, setPrompt] = useState("");
  const [importText, setImportText] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [materialCount, setMaterialCount] = useState<number | null>(null);

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

  const draftFromAiHref = subjectId
    ? `/teacher/tests?subjectId=${encodeURIComponent(subjectId)}#draft-from-ai`
    : "/teacher/tests#draft-from-ai";

  async function reloadBank() {
    const [nextSubjects, nextRubrics, nextQuestions] = await Promise.all([
      api<Subject[]>("/api/teaching/subjects", { auth: true }),
      api<Rubric[]>("/api/teaching/rubrics", { auth: true }),
      api<Question[]>("/api/teaching/questions", { auth: true }),
    ]);
    setSubjects(nextSubjects);
    setRubrics(nextRubrics);
    setQuestionStats({
      total: nextQuestions.length,
      pending: nextQuestions.filter((q) => q.status === "PENDING_REVIEW").length,
    });
    setSubjectId((current) => current || nextSubjects[0]?.id || "");
    setRubricId((current) =>
      resolveRubricIdForSubject(nextRubrics, subjectId || nextSubjects[0]?.id || "", current),
    );
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<Subject[]>("/api/teaching/subjects", { auth: true }),
      api<Rubric[]>("/api/teaching/rubrics", { auth: true }),
      api<Question[]>("/api/teaching/questions", { auth: true }),
    ])
      .then(([nextSubjects, nextRubrics, nextQuestions]) => {
        if (cancelled) return;
        setSubjects(nextSubjects);
        setRubrics(nextRubrics);
        setQuestionStats({
          total: nextQuestions.length,
          pending: nextQuestions.filter((q) => q.status === "PENDING_REVIEW").length,
        });
        setSubjectId((current) => current || nextSubjects[0]?.id || "");
        setRubricId((current) =>
          resolveRubricIdForSubject(nextRubrics, nextSubjects[0]?.id || "", current),
        );
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

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/teaching/questions", {
        method: "POST",
        auth: true,
        body: { subjectId, rubricId, topic, bloom, prompt },
      });
      setPrompt("");
      toast.success(t("teacher.bank.questionAdded"));
      await reloadBank();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("teacher.bank.loadError"));
    }
  }

  async function onImport(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await api<Question[]>("/api/teaching/questions/import", {
        method: "POST",
        auth: true,
        body: { subjectId, rubricId, topic, bloom, text: importText },
      });
      setImportText("");
      toast.success(t("teacher.bank.imported", { count: String(created.length) }));
      await reloadBank();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("teacher.bank.loadError"));
    }
  }

  async function onMaterial(event: FormEvent) {
    event.preventDefault();
    if (!file || !subjectId) return;
    const body = new FormData();
    body.set("subjectId", subjectId);
    body.set("file", file);
    setUploading(true);
    try {
      await api("/api/teaching/documents", { method: "POST", auth: true, body });
      setFile(null);
      toast.success(t("teacher.bank.materialAddedToList"));
      router.push(draftFromAiHref);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("teacher.bank.loadError"));
    } finally {
      setUploading(false);
    }
  }

  async function onCreateSubject(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await api<Subject>("/api/teaching/subjects", {
        method: "POST",
        auth: true,
        body: { code: subjectCode, name: subjectName },
      });
      setSubjectCode("");
      setSubjectName("");
      toast.success(t("teacher.bank.subjectCreated"));
      await reloadBank();
      setSubjectId(created.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("teacher.bank.loadError"));
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
    <div className="space-y-8">
      <TeacherPageHeader
        eyebrow={t("teacher.bank.eyebrow")}
        title={t("teacher.bank.title")}
        description={t("teacher.bank.lead")}
        breadcrumbs={[
          { href: "/teacher", label: t("nav.teacher.overview") },
          { label: t("nav.teacher.bank") },
        ]}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="font-serif text-2xl">{t("teacher.bank.officialTitle")}</CardTitle>
          <CardDescription>{t("teacher.bank.officialDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {questionStats.total === 0
              ? t("teacher.bank.empty")
              : t("teacher.bank.listSummary", {
                  total: String(questionStats.total),
                  pending: String(questionStats.pending),
                })}
          </p>
          <div className="flex flex-wrap gap-2">
            {questionStats.pending > 0 ? (
              <Link
                href="/teacher/bank/questions?status=PENDING_REVIEW"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                {t("teacher.bank.openPendingList")}
              </Link>
            ) : null}
            <Link
              href="/teacher/bank/questions"
              className={cn(buttonVariants(), "inline-flex items-center gap-2")}
            >
              {t("teacher.bank.openQuestionList")}
              <ArrowRightIcon className="size-4" aria-hidden />
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="font-serif text-2xl">{t("teacher.bank.subjectTitle")}</CardTitle>
          <CardDescription>{t("teacher.bank.subjectDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onCreateSubject}>
            <Field className="flex-1">
              <FieldLabel htmlFor="subject-code">{t("teacher.bank.codePlaceholder")}</FieldLabel>
              <Input
                id="subject-code"
                value={subjectCode}
                onChange={(event) => setSubjectCode(event.target.value)}
                required
              />
            </Field>
            <Field className="flex-1">
              <FieldLabel htmlFor="subject-name">{t("teacher.bank.namePlaceholder")}</FieldLabel>
              <Input
                id="subject-name"
                value={subjectName}
                onChange={(event) => setSubjectName(event.target.value)}
                required
              />
            </Field>
            <Button type="submit">{t("teacher.bank.createSubject")}</Button>
          </form>

          <form className="space-y-3" onSubmit={onMaterial}>
            <Field>
              <FieldLabel htmlFor="material-subject">{t("teacher.common.subject")}</FieldLabel>
              <select
                id="material-subject"
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                required
              >
                {subjects.length === 0 ? (
                  <option value="">{t("teacher.bank.createSubjectFirst")}</option>
                ) : null}
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} — {subject.name}
                  </option>
                ))}
              </select>
            </Field>
            <MaterialDropzone
              id="material-file"
              file={file}
              onFileChange={setFile}
              disabled={!subjectId || uploading}
              label={t("teacher.bank.dropzoneLabel")}
              dropTitle={t("teacher.bank.dropzoneTitle")}
              dropHint={t("teacher.bank.dropzoneHint")}
              dropActive={t("teacher.bank.dropzoneActive")}
              invalidTypeMessage={t("teacher.bank.dropzoneInvalidType")}
              selectedLabel={(name) => t("teacher.bank.dropzoneSelected", { name })}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!subjectId || !file || uploading}>
                {uploading ? t("teacher.common.loading") : t("teacher.bank.importMaterial")}
              </Button>
              {subjectId && materialCount !== null && materialCount > 0 ? (
                <Link
                  href={draftFromAiHref}
                  className={cn(buttonVariants({ variant: "secondary" }), "inline-flex items-center gap-2")}
                >
                  <SparklesIcon className="size-4" aria-hidden />
                  {t("teacher.bank.draftQuestionsFromMaterial")}
                </Link>
              ) : (
                <Button type="button" variant="secondary" disabled className="inline-flex items-center gap-2">
                  <SparklesIcon className="size-4" aria-hidden />
                  {t("teacher.bank.draftQuestionsFromMaterial")}
                </Button>
              )}
            </div>
            {subjectId && materialCount === 0 ? (
              <p className="text-xs text-muted-foreground">{t("teacher.bank.draftAiNeedsMaterial")}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="font-serif text-2xl">{t("teacher.bank.addTitle")}</CardTitle>
          <CardDescription>{t("teacher.bank.addDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <SharedFields
            subjects={subjects}
            rubrics={rubrics}
            subjectId={subjectId}
            rubricId={rubricId}
            topic={topic}
            bloom={bloom}
            locale={locale}
            onSubject={(value) => {
              setSubjectId(value);
              setRubricId((current) => resolveRubricIdForSubject(rubrics, value, current));
            }}
            subjectRubrics={subjectRubrics}
            onRubric={setRubricId}
            onTopic={setTopic}
            onBloom={setBloom}
            t={t}
          />
          <form className="space-y-3" onSubmit={onCreate}>
            <Field>
              <FieldLabel htmlFor="question-prompt">{t("teacher.common.prompt")}</FieldLabel>
              <textarea
                id="question-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                required
                className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder={t("teacher.bank.promptPlaceholder")}
              />
            </Field>
            <Button type="submit" disabled={!subjectId || !rubricId}>
              {t("teacher.bank.addToBank")}
            </Button>
          </form>
          <form className="space-y-3" onSubmit={onImport}>
            <Field>
              <FieldLabel htmlFor="import-lines">{t("teacher.bank.importLines")}</FieldLabel>
              <textarea
                id="import-lines"
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder={t("teacher.bank.importLinesPlaceholder")}
              />
            </Field>
            <Button type="submit" variant="outline" disabled={!subjectId || !rubricId}>
              {t("teacher.bank.importLines")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function SharedFields({
  subjects,
  rubrics,
  subjectRubrics,
  subjectId,
  rubricId,
  topic,
  bloom,
  locale,
  onSubject,
  onRubric,
  onTopic,
  onBloom,
  t,
}: {
  subjects: Subject[];
  rubrics: Rubric[];
  subjectRubrics: Rubric[];
  subjectId: string;
  rubricId: string;
  topic: string;
  bloom: (typeof BLOOM)[number];
  locale: "en" | "vi";
  onSubject: (value: string) => void;
  onRubric: (value: string) => void;
  onTopic: (value: string) => void;
  onBloom: (value: (typeof BLOOM)[number]) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="shared-subject">{t("teacher.common.subject")}</FieldLabel>
        <select
          id="shared-subject"
          className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
          value={subjectId}
          onChange={(event) => onSubject(event.target.value)}
        >
          {subjects.length === 0 ? <option value="">{t("teacher.bank.createSubjectFirst")}</option> : null}
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.code} — {subject.name}
            </option>
          ))}
        </select>
      </Field>
      <Field>
        <RubricFieldLabel
          htmlFor="shared-rubric"
          subjectId={subjectId}
          rubricId={rubricId}
          label={t("teacher.common.rubric")}
          hint={t("teacher.rubrics.editLink")}
          returnTo="/teacher/bank"
        />
        <select
          id="shared-rubric"
          className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
          value={rubricId}
          onChange={(event) => onRubric(event.target.value)}
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
        <FieldLabel htmlFor="shared-topic">{t("teacher.common.topic")}</FieldLabel>
        <Input id="shared-topic" value={topic} onChange={(event) => onTopic(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="shared-bloom">{t("teacher.common.bloom")}</FieldLabel>
        <select
          id="shared-bloom"
          className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
          value={bloom}
          onChange={(event) => onBloom(event.target.value as (typeof BLOOM)[number])}
        >
          {BLOOM.map((level) => (
            <option key={level} value={level}>
              {formatBloom(level, locale)}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
