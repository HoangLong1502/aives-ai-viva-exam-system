"use client";

import { PageHeader } from "@/components/admin/ui/dashboard-ui";
import { ScoreTable } from "@/components/score-table";
import { useLocale } from "@/lib/i18n/locale-provider";

export function StudentScoresView() {
  const { t } = useLocale();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("student.scores.eyebrow")} title={t("student.scores.title")} />
      <ScoreTable
        path="/api/student/scores"
        reviewHref={(row) => (row.attemptStatus === "SUBMITTED" ? `/student/scores/${row.id}` : null)}
      />
    </div>
  );
}
