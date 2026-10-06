"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, attemptStatusVariant } from "@/components/teacher/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import { formatAttemptStatus } from "@/lib/teacher/labels";

export type Attempt = {
  id: string;
  examTitle: string;
  studentName: string;
  teacherName: string;
  score: number | null;
  status: string;
};

export function ScoreTable({
  path,
  canGrade = false,
  search = "",
  needsGradingOnly = false,
}: {
  path: string;
  canGrade?: boolean;
  search?: string;
  needsGradingOnly?: boolean;
}) {
  const { t, messages } = useLocale();
  const labels = messages.teacher.labels;
  const [rows, setRows] = useState<Attempt[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function applyRows(next: Attempt[]) {
    setRows(next);
    setDrafts(
      Object.fromEntries(next.map((row) => [row.id, row.score == null ? "" : String(row.score)])),
    );
  }

  useEffect(() => {
    let cancelled = false;
    api<Attempt[]>(path, { auth: true })
      .then((next) => {
        if (!cancelled) applyRows(next);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(
          error instanceof ApiError
            ? error.message
            : canGrade
              ? t("teacher.scores.loadError")
              : "Could not load scores.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, canGrade, t]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (needsGradingOnly && row.score != null) return false;
      if (!query) return true;
      return (
        row.examTitle.toLowerCase().includes(query) ||
        row.studentName.toLowerCase().includes(query)
      );
    });
  }, [rows, search, needsGradingOnly]);

  async function save(id: string) {
    const score = Number(drafts[id]);
    if (Number.isNaN(score)) {
      toast.error(t("teacher.scores.scoreLabel"));
      return;
    }
    setSavingId(id);
    try {
      await api(`/api/teaching/scores/${id}`, {
        method: "PATCH",
        auth: true,
        body: { score },
      });
      toast.success(canGrade ? t("teacher.scores.saved") : "Score saved.");
      const next = await api<Attempt[]>(path, { auth: true });
      applyRows(next);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("teacher.scores.loadError"));
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-label={t("teacher.common.loading")} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            {canGrade ? t("teacher.scores.empty") : "No scores yet."}
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            {t("teacher.common.noResults")}
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-medium">{row.examTitle}</p>
                  <p className="text-sm text-muted-foreground">{row.studentName}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={formatAttemptStatus(row.status, labels.attemptStatus)}
                      variant={attemptStatusVariant(row.status)}
                    />
                    {canGrade ? (
                      <span className="text-xs text-muted-foreground">{t("teacher.scores.teacherFinal")}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {row.teacherName ? row.teacherName : row.status}
                      </span>
                    )}
                  </div>
                </div>
                {canGrade ? (
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-24"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      aria-label={t("teacher.scores.scoreLabel")}
                      value={drafts[row.id] ?? ""}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [row.id]: event.target.value }))
                      }
                      placeholder="0–100"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={savingId === row.id}
                      onClick={() => void save(row.id)}
                    >
                      {savingId === row.id ? t("teacher.common.loading") : t("teacher.common.save")}
                    </Button>
                  </div>
                ) : (
                  <p className="font-serif text-2xl tabular-nums">{row.score ?? "—"}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
