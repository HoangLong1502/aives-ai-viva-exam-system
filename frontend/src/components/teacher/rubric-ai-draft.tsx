"use client";

import { FormEvent, useState } from "react";
import { Loader2Icon, PlusIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { TeachingRubricDetail } from "@/lib/teacher/rubrics";

type DraftCriterion = { key: string; name: string; description: string; maxPoints: string };
type Draft = { name: string; description: string; criteria: DraftCriterion[] };
type DraftResponse = {
  name: string;
  description: string;
  criteria: { name: string; description: string; maxPoints: number }[];
};

const textareaClass =
  "min-h-16 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

let keySeq = 0;
const nextKey = () => `c-${++keySeq}`;

/**
 * Drafts a rubric for the subject from its uploaded material with AI. The teacher reviews and edits the
 * draft here; it becomes a rubric only when they save it.
 */
export function RubricAiDraft({
  subjectId,
  subjectLabel,
  onSaved,
}: {
  subjectId: string;
  subjectLabel: string;
  onSaved: (rubric: TeachingRubricDetail) => void;
}) {
  const { t } = useLocale();
  const [focus, setFocus] = useState("");
  const [criteriaCount, setCriteriaCount] = useState("4");
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const total = draft
    ? draft.criteria.reduce((sum, criterion) => sum + (Number(criterion.maxPoints) || 0), 0)
    : 0;

  async function generate() {
    if (!subjectId) {
      setError(t("teacher.rubrics.pickSubject"));
      return;
    }
    setDrafting(true);
    setError(null);
    try {
      const result = await api<DraftResponse>("/api/teaching/rubrics/draft", {
        method: "POST",
        auth: true,
        body: { subjectId, focus: focus.trim() || null, criteriaCount: Number(criteriaCount), totalPoints: 10 },
      });
      setDraft({
        name: result.name,
        description: result.description,
        criteria: result.criteria.map((criterion) => ({
          key: nextKey(),
          name: criterion.name,
          description: criterion.description,
          maxPoints: String(criterion.maxPoints),
        })),
      });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t("teacher.rubrics.aiError"));
    } finally {
      setDrafting(false);
    }
  }

  function updateCriterion(key: string, patch: Partial<DraftCriterion>) {
    setDraft((current) =>
      current
        ? { ...current, criteria: current.criteria.map((c) => (c.key === key ? { ...c, ...patch } : c)) }
        : current,
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const criteria = draft.criteria.map((criterion, index) => ({
      id: "",
      name: criterion.name.trim(),
      description: criterion.description.trim(),
      maxPoints: Number(criterion.maxPoints),
      sortOrder: index,
    }));
    if (!draft.name.trim() || criteria.length === 0 || criteria.some((c) => !c.name || !(c.maxPoints > 0))) {
      setError(t("teacher.rubrics.aiInvalid"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await api<TeachingRubricDetail>("/api/teaching/rubrics", {
        method: "POST",
        auth: true,
        body: { subjectId, name: draft.name.trim(), description: draft.description.trim(), criteria },
      });
      toast.success(t("teacher.rubrics.created"));
      setDraft(null);
      setFocus("");
      onSaved(saved);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t("teacher.rubrics.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-primary" aria-hidden />
          {t("teacher.rubrics.aiTitle")}
        </CardTitle>
        <CardDescription>
          {subjectId ? t("teacher.rubrics.aiDesc", { subject: subjectLabel }) : t("teacher.rubrics.pickSubject")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
          <Field>
            <FieldLabel htmlFor="rubric-ai-focus">{t("teacher.rubrics.aiFocus")}</FieldLabel>
            <Input
              id="rubric-ai-focus"
              value={focus}
              maxLength={255}
              onChange={(event) => setFocus(event.target.value)}
              placeholder={t("teacher.rubrics.aiFocusPlaceholder")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="rubric-ai-count">{t("teacher.rubrics.aiCount")}</FieldLabel>
            <select
              id="rubric-ai-count"
              className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm shadow-xs"
              value={criteriaCount}
              onChange={(event) => setCriteriaCount(event.target.value)}
            >
              {[2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </Field>
          <Button type="button" variant={draft ? "outline" : "default"} disabled={!subjectId || drafting} onClick={() => void generate()}>
            {drafting ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
            {drafting
              ? t("teacher.rubrics.aiDrafting")
              : draft
                ? t("teacher.rubrics.aiRegenerate")
                : t("teacher.rubrics.aiGenerate")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("teacher.rubrics.aiHint")}</p>

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {draft ? (
          <form className="space-y-4 rounded-xl border border-dashed border-primary/30 bg-muted/30 p-4" onSubmit={save}>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("teacher.rubrics.aiReview")}
            </p>
            <Field>
              <FieldLabel htmlFor="rubric-ai-name">{t("teacher.rubrics.nameLabel")}</FieldLabel>
              <Input
                id="rubric-ai-name"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="rubric-ai-description">{t("teacher.rubrics.descriptionLabel")}</FieldLabel>
              <textarea
                id="rubric-ai-description"
                className={textareaClass}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </Field>

            <ol className="space-y-3">
              {draft.criteria.map((criterion, index) => (
                <li key={criterion.key} className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {t("teacher.rubrics.criterion")} {index + 1}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("teacher.rubrics.aiRemove")}
                      disabled={draft.criteria.length <= 1}
                      onClick={() =>
                        setDraft({ ...draft, criteria: draft.criteria.filter((c) => c.key !== criterion.key) })
                      }
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
                    <Input
                      aria-label={t("teacher.rubrics.criterionName")}
                      value={criterion.name}
                      onChange={(event) => updateCriterion(criterion.key, { name: event.target.value })}
                      required
                    />
                    <Input
                      aria-label={t("teacher.rubrics.maxPoints")}
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={criterion.maxPoints}
                      onChange={(event) => updateCriterion(criterion.key, { maxPoints: event.target.value })}
                      required
                    />
                  </div>
                  <textarea
                    aria-label={t("teacher.rubrics.criterionDesc")}
                    className={textareaClass}
                    value={criterion.description}
                    onChange={(event) => updateCriterion(criterion.key, { description: event.target.value })}
                  />
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={draft.criteria.length >= 8}
                onClick={() =>
                  setDraft({
                    ...draft,
                    criteria: [...draft.criteria, { key: nextKey(), name: "", description: "", maxPoints: "1" }],
                  })
                }
              >
                <PlusIcon />
                {t("teacher.rubrics.aiAdd")}
              </Button>
              <p className="text-sm text-muted-foreground">
                {t("teacher.rubrics.maxScore", { score: String(Math.round(total * 10) / 10) })}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? t("teacher.rubrics.saving") : t("teacher.rubrics.aiSave")}
              </Button>
              <Button type="button" variant="ghost" disabled={saving} onClick={() => setDraft(null)}>
                {t("teacher.rubrics.aiDiscard")}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
