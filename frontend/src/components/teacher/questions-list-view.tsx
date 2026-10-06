"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";
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
import {
  formatBloom,
  formatQuestionSource,
  formatQuestionStatus,
} from "@/lib/teacher/labels";
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
};

type DocumentRow = {
  id: string;
  name: string;
  chunks: number;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
};

type FilterStatus = "ALL" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

function parseInitialStatus(value: string | null): FilterStatus {
  if (value === "PENDING_REVIEW" || value === "APPROVED" || value === "REJECTED") {
    return value;
  }
  return "ALL";
}

export function TeacherQuestionsListView() {
  const { t, locale, messages } = useLocale();
  const labels = messages.teacher.labels;
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [materials, setMaterials] = useState<DocumentRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(() =>
    parseInitialStatus(searchParams.get("status")),
  );
  const [filterSubjectId, setFilterSubjectId] = useState(() => {
    const subjectParam = searchParams.get("subjectId");
    return subjectParam && subjectParam.length > 0 ? subjectParam : "ALL";
  });
  const [rejectTarget, setRejectTarget] = useState<Question | null>(null);
  const [rejecting, setRejecting] = useState(false);
  useEffect(() => {
    setFilterStatus(parseInitialStatus(searchParams.get("status")));
    const subjectParam = searchParams.get("subjectId");
    if (subjectParam) {
      setFilterSubjectId(subjectParam);
    }
  }, [searchParams]);

  const loadMaterials = useCallback(async (subjectList: Subject[]) => {
    if (subjectList.length === 0) {
      setMaterials([]);
      return;
    }
    const docGroups = await Promise.all(
      subjectList.map(async (subject) => {
        const docs = await api<{ id: string; name: string; chunks: number }[]>(
          `/api/teaching/documents?subjectId=${subject.id}`,
          { auth: true },
        );
        return docs.map((doc) => ({
          ...doc,
          subjectId: subject.id,
          subjectName: subject.name,
          subjectCode: subject.code,
        }));
      }),
    );
    setMaterials(docGroups.flat());
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<Subject[]>("/api/teaching/subjects", { auth: true }),
      api<Question[]>("/api/teaching/questions", { auth: true }),
    ])
      .then(async ([nextSubjects, nextQuestions]) => {
        if (cancelled) return;
        setSubjects(nextSubjects);
        setQuestions(nextQuestions);
        await loadMaterials(nextSubjects);
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
  }, [t, loadMaterials]);

  const filteredQuestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return questions.filter((question) => {
      if (filterStatus !== "ALL" && question.status !== filterStatus) return false;
      if (filterSubjectId !== "ALL" && question.subjectId !== filterSubjectId) return false;
      if (!query) return true;
      return (
        question.prompt.toLowerCase().includes(query) ||
        question.topic.toLowerCase().includes(query) ||
        question.subjectName.toLowerCase().includes(query)
      );
    });
  }, [questions, search, filterStatus, filterSubjectId]);

  const filteredMaterials = useMemo(() => {
    const query = search.trim().toLowerCase();
    return materials.filter((material) => {
      if (filterSubjectId !== "ALL" && material.subjectId !== filterSubjectId) return false;
      if (!query) return true;
      return (
        material.name.toLowerCase().includes(query) ||
        material.subjectName.toLowerCase().includes(query) ||
        material.subjectCode.toLowerCase().includes(query)
      );
    });
  }, [materials, search, filterSubjectId]);

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
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("teacher.bank.loadError"));
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
        description={t("teacher.bank.officialDesc")}
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
          <CardTitle className="font-serif text-xl">{t("teacher.bank.listToolbar")}</CardTitle>
          <CardDescription>
            {t("teacher.bank.listCountFull", {
              materials: String(filteredMaterials.length),
              questions: String(filteredQuestions.length),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field className="flex-1">
              <FieldLabel htmlFor="bank-search">{t("teacher.common.search")}</FieldLabel>
              <Input
                id="bank-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("teacher.common.searchPlaceholder")}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="bank-status">{t("teacher.common.filterStatus")}</FieldLabel>
              <select
                id="bank-status"
                className="h-9 w-full min-w-40 rounded-lg border border-input bg-background px-2 text-sm"
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value as FilterStatus)}
              >
                <option value="ALL">{t("teacher.common.allStatuses")}</option>
                <option value="PENDING_REVIEW">
                  {formatQuestionStatus("PENDING_REVIEW", labels.questionStatus)}
                </option>
                <option value="APPROVED">{formatQuestionStatus("APPROVED", labels.questionStatus)}</option>
                <option value="REJECTED">{formatQuestionStatus("REJECTED", labels.questionStatus)}</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="bank-subject">{t("teacher.common.filterSubject")}</FieldLabel>
              <select
                id="bank-subject"
                className="h-9 w-full min-w-40 rounded-lg border border-input bg-background px-2 text-sm"
                value={filterSubjectId}
                onChange={(event) => setFilterSubjectId(event.target.value)}
              >
                <option value="ALL">{t("teacher.common.allSubjects")}</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <ul className="divide-y border-t">
            {filteredMaterials.map((material) => (
              <li
                key={`material-${material.id}`}
                className="flex flex-col gap-3 px-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={t("teacher.bank.materialBadge")} variant="info" />
                    <span className="text-xs text-muted-foreground">
                      {material.subjectCode} — {material.subjectName}
                    </span>
                  </div>
                  <p className="font-medium">{material.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("teacher.bank.materialIndexed", { chunks: String(material.chunks) })}
                  </p>
                </div>
                <Link
                  href={`/teacher/tests?subjectId=${encodeURIComponent(material.subjectId)}#draft-from-ai`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  {t("teacher.bank.draftQuestionsFromMaterial")}
                </Link>
              </li>
            ))}

            {filteredMaterials.length === 0 && filteredQuestions.length === 0 ? (
              <li className="px-2 py-8 text-center text-sm text-muted-foreground sm:px-6">
                {materials.length === 0 && questions.length === 0
                  ? `${t("teacher.bank.noMaterialsInList")} ${t("teacher.bank.empty")}`
                  : t("teacher.common.noResults")}
              </li>
            ) : null}

            {filteredQuestions.map((question) => (
                <li key={question.id} className="space-y-2 px-2 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={formatQuestionStatus(question.status, labels.questionStatus)}
                      variant={questionStatusVariant(question.status)}
                    />
                    <StatusBadge
                      label={formatQuestionSource(question.source, labels.questionSource)}
                      variant="neutral"
                    />
                    <StatusBadge label={formatBloom(question.bloom, locale)} variant="info" />
                    <span className="text-xs text-muted-foreground">{question.subjectName}</span>
                  </div>
                  {question.status === "PENDING_REVIEW" ? (
                    <textarea
                      aria-label={t("teacher.common.prompt")}
                      value={edits[question.id] ?? question.prompt}
                      onChange={(event) =>
                        setEdits((current) => ({ ...current, [question.id]: event.target.value }))
                      }
                      className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  ) : (
                    <p className="font-medium">{question.prompt}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {question.rubricName}: {question.criteria} (max {question.maxScore})
                    {question.sourceRef ? ` · ${question.sourceRef}` : ""}
                  </p>
                  {question.status === "PENDING_REVIEW" ? (
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
                  ) : null}
                </li>
              ))}
          </ul>
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
