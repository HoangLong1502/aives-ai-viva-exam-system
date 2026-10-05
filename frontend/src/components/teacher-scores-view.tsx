"use client";

import { ScoreTable } from "@/components/score-table";
import { useLocale } from "@/lib/i18n/locale-provider";

export function TeacherScoresView() {
  const { t } = useLocale();

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {t("teacher.scores.eyebrow")}
        </p>
        <h1 className="font-serif text-4xl tracking-tight">{t("teacher.scores.title")}</h1>
      </section>
      <ScoreTable path="/api/teaching/scores" canGrade />
    </div>
  );
}
