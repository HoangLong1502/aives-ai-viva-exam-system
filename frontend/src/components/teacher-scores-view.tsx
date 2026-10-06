"use client";

import { useState } from "react";
import { ScoreTable } from "@/components/score-table";
import { TeacherPageHeader } from "@/components/teacher/page-header";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/i18n/locale-provider";

export function TeacherScoresView() {
  const { t } = useLocale();
  const [search, setSearch] = useState("");
  const [needsGradingOnly, setNeedsGradingOnly] = useState(false);

  return (
    <div className="space-y-6">
      <TeacherPageHeader
        eyebrow={t("teacher.scores.eyebrow")}
        title={t("teacher.scores.title")}
        description={t("teacher.scores.lead")}
        breadcrumbs={[
          { href: "/teacher", label: t("nav.teacher.overview") },
          { label: t("nav.teacher.scores") },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field className="flex-1">
          <FieldLabel htmlFor="scores-search">{t("teacher.common.search")}</FieldLabel>
          <Input
            id="scores-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("teacher.scores.searchPlaceholder")}
          />
        </Field>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={needsGradingOnly}
            onChange={(event) => setNeedsGradingOnly(event.target.checked)}
          />
          {t("teacher.scores.filterNeedsGrading")}
        </label>
      </div>

      <ScoreTable
        path="/api/teaching/scores"
        canGrade
        search={search}
        needsGradingOnly={needsGradingOnly}
      />
    </div>
  );
}
