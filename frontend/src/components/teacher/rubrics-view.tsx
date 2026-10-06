"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { TeacherPageHeader } from "@/components/teacher/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import { rubricsForSubject, type TeachingRubric } from "@/lib/teacher/rubrics";
import { cn } from "cn";

type Subject = { id: string; code: string; name: string };

export function TeacherRubricsView() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rubrics, setRubrics] = useState<TeachingRubric[]>([]);
  const [subjectId, setSubjectId] = useState(() => searchParams.get("subjectId") ?? "");

  useEffect(() => {
    const param = searchParams.get("subjectId");
    if (param) {
      setSubjectId(param);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api<Subject[]>("/api/teaching/subjects", { auth: true }),
      api<TeachingRubric[]>("/api/teaching/rubrics", { auth: true }),
    ])
      .then(([nextSubjects, nextRubrics]) => {
        if (cancelled) return;
        setSubjects(nextSubjects);
        setRubrics(nextRubrics);
        setSubjectId((current) => {
          if (current && nextSubjects.some((subject) => subject.id === current)) {
            return current;
          }
          return nextSubjects[0]?.id ?? "";
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : t("teacher.rubrics.loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const filtered = useMemo(() => {
    if (!subjectId) return rubrics;
    return rubricsForSubject(rubrics, subjectId);
  }, [rubrics, subjectId]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TeacherPageHeader
        eyebrow={t("teacher.rubrics.eyebrow")}
        title={t("teacher.rubrics.title")}
        description={t("teacher.rubrics.lead")}
        breadcrumbs={[
          { href: "/teacher/bank", label: t("teacher.pages.bank") },
          { label: t("teacher.rubrics.title") },
        ]}
      />

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("teacher.rubrics.listTitle")}</CardTitle>
          <CardDescription>{t("teacher.rubrics.listDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field className="max-w-md">
            <FieldLabel htmlFor="rubrics-subject">{t("teacher.common.filterSubject")}</FieldLabel>
            <select
              id="rubrics-subject"
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
            >
              <option value="">{t("teacher.common.allSubjects")}</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} — {subject.name}
                </option>
              ))}
            </select>
          </Field>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("teacher.rubrics.empty")}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {filtered.map((rubric) => (
                <li key={rubric.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{rubric.name}</p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{rubric.criteria || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("teacher.rubrics.maxScore", { score: String(rubric.maxScore) })}
                    </p>
                  </div>
                  <Link
                    href={`/teacher/rubrics/${rubric.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
                  >
                    {t("teacher.rubrics.edit")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Link href="/teacher/bank" className={cn(buttonVariants({ variant: "ghost" }))}>
        {t("teacher.bank.backToBank")}
      </Link>
    </div>
  );
}
