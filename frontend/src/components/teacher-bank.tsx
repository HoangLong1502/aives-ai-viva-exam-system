"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { MaterialDropzone } from "@/components/teacher/material-dropzone";
import { MaterialLibrary, type Material } from "@/components/teacher/material-library";
import { RubricFieldLabel } from "@/components/teacher/rubric-field-label";
import { TeacherPageHeader } from "@/components/teacher/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
  expectedAnswer?: string | null;
  keyPoints?: string | null;
};

const BLOOM = ["EASY", "MEDIUM", "HARD"] as const;

export function TeacherBank() {
  const { t, locale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [questionStats, setQuestionStats] = useState({ total: 0, pending: 0 });
  const [subjectId, setSubjectId] = useState("");
  const [rubricId, setRubricId] = useState("");
  const [topic, setTopic] = useState("Oral reasoning");
  const [bloom, setBloom] = useState<(typeof BLOOM)[number]>("EASY");
  const [files, setFiles] = useState<File[]>([]);
  const [materialTopic, setMaterialTopic] = useState("");
  const [libraryKey, setLibraryKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [workingCount, setWorkingCount] = useState(0);
  const [materialsKnown, setMaterialsKnown] = useState(false);
  const [readyMaterials, setReadyMaterials] = useState<Material[]>([]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [count, setCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const subjectRubrics = useMemo(
    () => rubricsForSubject(rubrics, subjectId),
    [rubrics, subjectId],
  );
  const effectiveRubricId = resolveRubricIdForSubject(rubrics, subjectId, rubricId) ?? "";

  const onMaterialsChange = useCallback((materials: Material[]) => {
    const ready = materials.filter((material) => material.status === "DONE");
    setReadyMaterials(ready);
    setReadyCount(ready.length);
    setWorkingCount(
      materials.filter((material) => material.status === "PENDING" || material.status === "PROCESSING").length,
    );
    setMaterialsKnown(true);
    setSelectedDocId((current) => {
      if (ready.some((material) => material.id === current)) return current;
      return ready.length === 1 ? ready[0].id : "";
    });
  }, []);

  useEffect(() => {
    setReadyCount(0);
    setWorkingCount(0);
    setMaterialsKnown(false);
    setReadyMaterials([]);
    setSelectedDocId("");
  }, [subjectId]);

  useEffect(() => {
    setRubricId((current) => resolveRubricIdForSubject(rubrics, subjectId, current));
  }, [rubrics, subjectId]);

  function applyQuestions(nextQuestions: Question[]) {
    setQuestionStats({
      total: nextQuestions.length,
      pending: nextQuestions.filter((question) => question.status === "PENDING_REVIEW").length,
    });
  }

  async function reloadBank() {
    const [nextSubjects, nextRubrics, nextQuestions] = await Promise.all([
      api<Subject[]>("/api/teaching/subjects/catalog", { auth: true }),
      api<Rubric[]>("/api/teaching/rubrics", { auth: true }),
      api<Question[]>("/api/teaching/questions", { auth: true }),
    ]);
    setSubjects(nextSubjects);
    setRubrics(nextRubrics);
    applyQuestions(nextQuestions);
    setRubricId((current) => resolveRubricIdForSubject(nextRubrics, subjectId, current));
  }

  async function chooseSubject(nextSubjectId: string) {
    setGenerateError(null);
    if (!nextSubjectId) {
      setSubjectId("");
      return;
    }
    try {
      await api(`/api/teaching/subjects/${nextSubjectId}/use`, { method: "POST", auth: true });
      const nextRubrics = await api<Rubric[]>("/api/teaching/rubrics", { auth: true });
      setRubrics(nextRubrics);
      setSubjectId(nextSubjectId);
      setRubricId((current) => resolveRubricIdForSubject(nextRubrics, nextSubjectId, current));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("teacher.bank.loadError"));
    }
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<Subject[]>("/api/teaching/subjects/catalog", { auth: true }),
      api<Rubric[]>("/api/teaching/rubrics", { auth: true }),
      api<Question[]>("/api/teaching/questions", { auth: true }),
    ])
      .then(([nextSubjects, nextRubrics, nextQuestions]) => {
        if (cancelled) return;
        setSubjects(nextSubjects);
        setRubrics(nextRubrics);
        applyQuestions(nextQuestions);
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

  async function onUpload(event: FormEvent) {
    event.preventDefault();
    if (files.length === 0 || !subjectId) return;
    setUploading(true);
    const failed: File[] = [];
    for (const file of files) {
      const body = new FormData();
      body.set("subjectId", subjectId);
      if (materialTopic.trim()) body.set("topic", materialTopic.trim());
      body.set("file", file);
      try {
        await api("/api/teaching/documents", { method: "POST", auth: true, body });
      } catch (error) {
        failed.push(file);
        toast.error(`${file.name}: ${error instanceof ApiError ? error.message : t("teacher.bank.loadError")}`);
      }
    }
    const queued = files.length - failed.length;
    if (queued > 0) {
      toast.success(t("teacher.bank.materialQueued", { count: String(queued) }));
    }
    setFiles(failed);
    setLibraryKey((key) => key + 1);
    setUploading(false);
  }

  async function onGenerate() {
    setGenerateError(null);
    if (!subjectId || subjectRubrics.length === 0 || !effectiveRubricId) {
      const message =
        subjectId && subjectRubrics.length === 0
          ? t("teacher.tests.noRubricForSubject")
          : t("teacher.tests.chooseSubjectRubric");
      setGenerateError(message);
      toast.error(message);
      return;
    }
    if (readyCount === 0) {
      const message = t("teacher.bank.updateNeedsReady");
      setGenerateError(message);
      toast.error(message);
      return;
    }
    if (!selectedDocId) {
      const message = t("teacher.bank.selectFileRequired");
      setGenerateError(message);
      toast.error(message);
      return;
    }
    if (!topic.trim()) {
      const message = t("teacher.common.topic");
      setGenerateError(message);
      toast.error(message);
      return;
    }
    const boundedCount = Math.min(10, Math.max(1, Number(count) || 1));
    if (boundedCount !== count) setCount(boundedCount);
    setGenerating(true);
    try {
      const created = await api<Question[]>("/api/teaching/questions/generate", {
        method: "POST",
        auth: true,
        body: {
          subjectId,
          rubricId: effectiveRubricId,
          topic: topic.trim(),
          bloom,
          count: boundedCount,
          documentIds: [selectedDocId],
        },
      });
      toast.success(t("teacher.bank.updateAdded", { count: String(created.length) }));
      await reloadBank();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("teacher.bank.loadError");
      setGenerateError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
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
          <CardTitle className="font-serif text-2xl">{t("teacher.bank.updateTitle")}</CardTitle>
          <CardDescription>{t("teacher.bank.updateDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <Field>
            <FieldLabel htmlFor="update-subject">{t("teacher.common.subject")}</FieldLabel>
            <select
              id="update-subject"
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={subjectId}
              onChange={(event) => void chooseSubject(event.target.value)}
            >
              <option value="">
                {subjects.length === 0 ? t("teacher.bank.createSubjectFirst") : t("teacher.bank.selectSubject")}
              </option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} — {subject.name}
                </option>
              ))}
            </select>
          </Field>

          <form className="space-y-3" onSubmit={onUpload}>
            <MaterialDropzone
              id="update-material-file"
              files={files}
              onFilesChange={setFiles}
              disabled={!subjectId || uploading}
              label={t("teacher.bank.dropzoneLabel")}
              dropTitle={t("teacher.bank.dropzoneTitle")}
              dropHint={t("teacher.bank.dropzoneHint")}
              dropActive={t("teacher.bank.dropzoneActive")}
              invalidTypeMessage={t("teacher.bank.dropzoneInvalidType")}
              tooLargeMessage={(name) => t("teacher.bank.dropzoneTooLarge", { name })}
              removeLabel={(name) => t("teacher.bank.dropzoneRemove", { name })}
            />
            <Field>
              <FieldLabel htmlFor="update-material-topic">{t("teacher.bank.materialTopic")}</FieldLabel>
              <Input
                id="update-material-topic"
                value={materialTopic}
                maxLength={255}
                onChange={(event) => setMaterialTopic(event.target.value)}
                placeholder={t("teacher.bank.materialTopicPlaceholder")}
              />
            </Field>
            <Button type="submit" disabled={!subjectId || files.length === 0 || uploading}>
              {uploading ? t("teacher.common.loading") : t("teacher.bank.importMaterial")}
            </Button>
          </form>

          {subjectId ? (
            <MaterialLibrary
              subjectId={subjectId}
              refreshKey={libraryKey}
              onChange={onMaterialsChange}
              selectedId={selectedDocId}
              onSelect={readyCount > 1 ? setSelectedDocId : undefined}
            />
          ) : null}
          {subjectId && materialsKnown && readyCount > 1 ? (
            <p className="text-xs text-muted-foreground">{t("teacher.bank.selectFileHint")}</p>
          ) : null}

          <Separator />

          {generateError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {generateError}
            </p>
          ) : null}
          {subjectId && subjectRubrics.length === 0 ? (
            <p className="rounded-lg border px-3 py-2 text-sm text-muted-foreground" role="status">
              {t("teacher.tests.noRubricForSubject")}
            </p>
          ) : null}
          {subjectId && materialsKnown && readyCount === 0 ? (
            <p className="text-xs text-muted-foreground">{t("teacher.bank.updateNeedsReady")}</p>
          ) : null}
          {subjectId && readyCount > 0 && workingCount > 0 ? (
            <p className="text-xs text-muted-foreground">{t("teacher.bank.updateProcessing")}</p>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="update-source-file">{t("teacher.bank.sourceFile")}</FieldLabel>
              <select
                id="update-source-file"
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                value={selectedDocId}
                onChange={(event) => setSelectedDocId(event.target.value)}
              >
                <option value="">{t("teacher.bank.sourceFilePlaceholder")}</option>
                {readyMaterials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <RubricFieldLabel
                htmlFor="update-rubric"
                subjectId={subjectId}
                rubricId={effectiveRubricId}
                label={t("teacher.common.rubric")}
                hint={t("teacher.rubrics.editLink")}
                returnTo="/teacher/bank"
              />
              <select
                id="update-rubric"
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
              <FieldLabel htmlFor="update-topic">{t("teacher.common.topic")}</FieldLabel>
              <Input id="update-topic" value={topic} onChange={(event) => setTopic(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="update-bloom">{t("teacher.common.bloom")}</FieldLabel>
              <select
                id="update-bloom"
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
            <Field>
              <FieldLabel htmlFor="update-count">{t("teacher.tests.draftCount")}</FieldLabel>
              <Input
                id="update-count"
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              />
            </Field>
          </div>
          <Button
            type="button"
            className="inline-flex items-center gap-2"
            onClick={() => void onGenerate()}
            disabled={
              generating ||
              !subjectId ||
              subjectRubrics.length === 0 ||
              readyCount === 0 ||
              !selectedDocId
            }
          >
            <SparklesIcon className="size-4" aria-hidden />
            {generating
              ? t("teacher.tests.drafting")
              : t("teacher.tests.draftButton", { count: String(count) })}
          </Button>
          <p className="text-xs text-muted-foreground">{t("teacher.tests.generateHint")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
