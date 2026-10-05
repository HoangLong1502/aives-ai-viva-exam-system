"use client";

import { ScoreTable } from "@/components/score-table";
import { useLocale } from "@/lib/i18n/locale-provider";

export function StudentScoresView() {
  const { t } = useLocale();

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {t("student.scores.eyebrow")}
        </p>
        <h1 className="font-serif text-4xl tracking-tight">{t("student.scores.title")}</h1>
      </section>
      <ScoreTable path="/api/student/scores" />
    </div>
  );
}
