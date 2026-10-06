"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { TeacherPageHeader } from "@/components/teacher/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { TeachingRubricCriterion, TeachingRubricDetail } from "@/lib/teacher/rubrics";
import { cn } from "cn";

type DraftCriterion = {
  key: string;
  id: string;
  name: string;
  description: string;
  maxPoints: string;
};

function newDraftCriterion(): DraftCriterion {
  return {
    key: crypto.randomUUID(),
    id: "",
    name: "",
    description: "",
    maxPoints: "10",
  };
}

function toDraft(criteria: TeachingRubricCriterion[]): DraftCriterion[] {
  if (criteria.length === 0) {
    return [newDraftCriterion()];
  }
  return criteria.map((criterion) => ({
    key: criterion.id || crypto.randomUUID(),
    id: criterion.id,
    name: criterion.name,
    description: criterion.description,
    maxPoints: String(criterion.maxPoints),
  }));
}

export function TeacherRubricDetailView({ rubricId }: { rubricId: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subjectLabel, setSubjectLabel] = useState("");
  const [criteria, setCriteria] = useState<DraftCriterion[]>([newDraftCriterion()]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await api<TeachingRubricDetail>(`/api/teaching/rubrics/${rubricId}`, { auth: true });
      setName(detail.name);
      setDescription(detail.description);
      setSubjectLabel(`${detail.subjectCode} — ${detail.subjectName}`);
      setCriteria(toDraft(detail.criteria));
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : t("teacher.rubrics.loadError"));
    } finally {
      setLoading(false);
    }
  }, [rubricId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalMax = useMemo(() => {
    return criteria.reduce((sum, row) => {
      const value = Number.parseFloat(row.maxPoints);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  }, [criteria]);

  async function onSave() {
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        criteria: criteria.map((row, index) => ({
          id: row.id || undefined,
          name: row.name.trim(),
          description: row.description.trim(),
          maxPoints: Number.parseFloat(row.maxPoints) || 0,
          sortOrder: index,
        })),
      };
      await api<TeachingRubricDetail>(`/api/teaching/rubrics/${rubricId}`, {
        auth: true,
        method: "PUT",
        body: payload,
      });
      toast.success(t("teacher.rubrics.saved"));
      if (returnTo) {
        router.push(returnTo);
      } else {
        await load();
      }
    } catch (err: unknown) {
      toast.error(err instanceof ApiError ? err.message : t("teacher.rubrics.saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
        <Link href="/teacher/rubrics" className={cn(buttonVariants({ variant: "outline" }))}>
          {t("teacher.rubrics.backToList")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TeacherPageHeader
        title={t("teacher.rubrics.editTitle")}
        description={t("teacher.rubrics.editLead")}
        breadcrumbs={[
          { href: "/teacher/rubrics", label: t("teacher.rubrics.title") },
          { label: name || t("teacher.common.rubric") },
        ]}
        action={
          <Button type="button" onClick={() => void onSave()} disabled={saving}>
            {saving ? t("teacher.rubrics.saving") : t("teacher.common.save")}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("teacher.rubrics.metaTitle")}</CardTitle>
          <CardDescription>{subjectLabel}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="rubric-name">{t("teacher.rubrics.nameLabel")}</FieldLabel>
            <Input id="rubric-name" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field className="md:col-span-2">
            <FieldLabel htmlFor="rubric-description">{t("teacher.rubrics.descriptionLabel")}</FieldLabel>
            <textarea
              id="rubric-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>{t("teacher.rubrics.criteriaTitle")}</CardTitle>
            <CardDescription>{t("teacher.rubrics.criteriaDesc")}</CardDescription>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("teacher.rubrics.maxScore", { score: String(Math.round(totalMax)) })}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {criteria.map((row, index) => (
            <div key={row.key} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {t("teacher.rubrics.criterion")} {index + 1}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={criteria.length <= 1}
                  onClick={() => setCriteria((current) => current.filter((item) => item.key !== row.key))}
                  aria-label={t("teacher.rubrics.removeCriterion")}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_7rem]">
                <Field>
                  <FieldLabel htmlFor={`criterion-name-${row.key}`}>{t("teacher.rubrics.criterionName")}</FieldLabel>
                  <Input
                    id={`criterion-name-${row.key}`}
                    value={row.name}
                    onChange={(event) =>
                      setCriteria((current) =>
                        current.map((item) =>
                          item.key === row.key ? { ...item, name: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`criterion-points-${row.key}`}>{t("teacher.rubrics.maxPoints")}</FieldLabel>
                  <Input
                    id={`criterion-points-${row.key}`}
                    inputMode="decimal"
                    value={row.maxPoints}
                    onChange={(event) =>
                      setCriteria((current) =>
                        current.map((item) =>
                          item.key === row.key ? { ...item, maxPoints: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor={`criterion-desc-${row.key}`}>{t("teacher.rubrics.criterionDesc")}</FieldLabel>
                <textarea
                  id={`criterion-desc-${row.key}`}
                  rows={2}
                  value={row.description}
                  onChange={(event) =>
                    setCriteria((current) =>
                      current.map((item) =>
                        item.key === row.key ? { ...item, description: event.target.value } : item,
                      ),
                    )
                  }
                  className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </Field>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setCriteria((current) => [...current, newDraftCriterion()])}
          >
            <PlusIcon className="size-4" aria-hidden />
            {t("teacher.rubrics.addCriterion")}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link
          href={returnTo ?? "/teacher/rubrics"}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          {t("teacher.rubrics.backToList")}
        </Link>
      </div>
    </div>
  );
}
