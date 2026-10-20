"use client";

import { FormEvent, Fragment, useEffect, useState } from "react";
import { CalendarClockIcon } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, LoadingSkeleton } from "@/components/admin/ui/dashboard-ui";
import { SelectControl, TableScroller } from "@/components/admin/ui/controls";
import { ConfirmDialog } from "@/components/teacher/confirm-dialog";
import { StatusBadge } from "@/components/teacher/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  examStatusCounts,
  examStatusPresentation,
  fetchAdminStats,
  parseAdminStats,
  type AdminStats,
  type CountedExamStatus,
} from "@/lib/admin/dashboard";
import {
  ADMIN_EXAM_STATUSES,
  fetchAdminExams,
  fromLocalInput,
  rescheduleExam,
  setAdminExamStatus,
  toLocalInput,
  type AdminExam,
  type AdminExamStatus,
} from "@/lib/admin/exams";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import { cn } from "cn";

type Subject = { id: string; code: string; name: string };

const STATUS_KEY = {
  DRAFT: "draft",
  PUBLISHED: "published",
  SCHEDULED: "scheduled",
  IN_PROGRESS: "inProgress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const satisfies Record<AdminExamStatus, string>;

export function ExamSchedule() {
  const { t, messages, locale } = useLocale();
  const copy = messages.admin.settings;

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [exams, setExams] = useState<AdminExam[] | null>(null);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [status, setStatus] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminExam | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchAdminStats(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setStats(parseAdminStats(value));
        setStatsError(null);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setStatsError(reason instanceof ApiError ? reason.message : copy.scheduleLoadError);
      });
    api<Subject[]>("/api/admin/subjects", { auth: true, signal: controller.signal, cache: "no-store" })
      .then((value) => {
        if (!controller.signal.aborted) setSubjects(value);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [reloadKey, copy.scheduleLoadError]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAdminExams({ status, subjectId }, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setExams(value);
        setExamsError(null);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setExamsError(reason instanceof ApiError ? reason.message : copy.sessionsLoadError);
      });
    return () => controller.abort();
  }, [status, subjectId, reloadKey, copy.sessionsLoadError]);

  const dateFormat = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  function statusLabel(value: string) {
    return value in STATUS_KEY ? copy[STATUS_KEY[value as AdminExamStatus]] : value;
  }

  function statusVariant(value: string) {
    return value === "CANCELLED" ? "danger" : examStatusPresentation(value).tone;
  }

  function startEditing(exam: AdminExam) {
    setEditingId(exam.id);
    setScheduledAt(toLocalInput(exam.scheduledAt));
    setDuration(exam.durationMinutes ? String(exam.durationMinutes) : "");
  }

  function replaceExam(updated: AdminExam) {
    setExams((current) => current?.map((exam) => (exam.id === updated.id ? updated : exam)) ?? current);
  }

  async function saveSchedule(event: FormEvent, examId: string) {
    event.preventDefault();
    const minutes = duration ? Number(duration) : null;
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 600)) {
      toast.error(copy.durationInvalid);
      return;
    }
    setSavingSchedule(true);
    try {
      replaceExam(await rescheduleExam(examId, fromLocalInput(scheduledAt), minutes));
      setEditingId(null);
      toast.success(copy.rescheduled);
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : copy.rescheduleError);
    } finally {
      setSavingSchedule(false);
    }
  }

  async function changeStatus(exam: AdminExam, next: AdminExamStatus) {
    setBusyId(exam.id);
    try {
      replaceExam(await setAdminExamStatus(exam.id, next));
      toast.success(copy.statusUpdated);
      setReloadKey((current) => current + 1);
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : copy.statusError);
    } finally {
      setBusyId(null);
      setCancelTarget(null);
    }
  }

  return (
    <div className="space-y-8">
      <Card className="min-w-0">
        <CardHeader className="border-b">
          <CardTitle className="font-serif text-2xl">{copy.scheduleTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {statsError && stats === null ? (
            <ErrorState
              title={copy.scheduleLoadError}
              message={statsError}
              retryLabel={copy.retry}
              onRetry={() => setReloadKey((current) => current + 1)}
            />
          ) : stats === null ? (
            <LoadingSkeleton className="h-28 w-full" label={copy.loading} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-3">
              {examStatusCounts(stats).map((row) => (
                <li key={row.status} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span
                      className={cn("size-2 rounded-full", examStatusPresentation(row.status).barClass)}
                      aria-hidden
                    />
                    {copy[STATUS_KEY[row.status as CountedExamStatus]]}
                  </span>
                  <span className="mt-3 block font-serif text-3xl tabular-nums tracking-tight">
                    {row.total.toLocaleString()}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                    {t("admin.settings.formatSplit", {
                      multipleChoice: String(row.multipleChoice),
                      oral: String(row.oral),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="border-b">
          <CardTitle className="font-serif text-2xl">{copy.sessionsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,18rem)]">
            <label className="grid gap-1.5 text-sm" htmlFor="exam-status-filter">
              <span className="font-medium">{copy.filterStatus}</span>
              <SelectControl
                id="exam-status-filter"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">{copy.allStatuses}</option>
                {ADMIN_EXAM_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </SelectControl>
            </label>
            <label className="grid gap-1.5 text-sm" htmlFor="exam-subject-filter">
              <span className="font-medium">{copy.filterSubject}</span>
              <SelectControl
                id="exam-subject-filter"
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
              >
                <option value="">{copy.allSubjects}</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} — {subject.name}
                  </option>
                ))}
              </SelectControl>
            </label>
          </div>

          {examsError && exams === null ? (
            <ErrorState
              title={copy.sessionsLoadError}
              message={examsError}
              retryLabel={copy.retry}
              onRetry={() => setReloadKey((current) => current + 1)}
            />
          ) : exams === null ? (
            <LoadingSkeleton className="h-40 w-full" label={copy.loading} />
          ) : exams.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                <CalendarClockIcon className="size-5 text-muted-foreground" aria-hidden />
              </span>
              <p className="font-medium">{status || subjectId ? copy.sessionsNoResults : copy.sessionsEmptyTitle}</p>
            </div>
          ) : (
            <TableScroller>
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-2 font-medium">{copy.colExam}</th>
                    <th className="px-3 py-2 font-medium">{copy.colSubject}</th>
                    <th className="px-3 py-2 font-medium">{copy.colTeacher}</th>
                    <th className="px-3 py-2 font-medium">{copy.colSchedule}</th>
                    <th className="px-3 py-2 font-medium">{copy.colStatus}</th>
                    <th className="px-3 py-2 text-right font-medium">{copy.colActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {exams.map((exam) => (
                    <Fragment key={exam.id}>
                      <tr className="align-top">
                        <td className="px-3 py-3">
                          <p className="font-medium">{exam.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {exam.format === "ORAL" ? copy.oral : copy.multipleChoice} ·{" "}
                            {t("admin.settings.questionsAttempts", {
                              questions: String(exam.questionCount),
                              attempts: String(exam.attemptCount),
                            })}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-muted-foreground">{exam.subjectCode}</span> {exam.subjectName}
                        </td>
                        <td className="px-3 py-3">{exam.teacherName || "—"}</td>
                        <td className="px-3 py-3 tabular-nums">
                          {exam.scheduledAt ? (
                            <>
                              <p>{dateFormat.format(new Date(exam.scheduledAt))}</p>
                              {exam.durationMinutes ? (
                                <p className="text-xs text-muted-foreground">
                                  {t("admin.settings.minutes", { count: String(exam.durationMinutes) })}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-muted-foreground">{copy.notScheduled}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge label={statusLabel(exam.status)} variant={statusVariant(exam.status)} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => (editingId === exam.id ? setEditingId(null) : startEditing(exam))}
                            >
                              {copy.reschedule}
                            </Button>
                            <SelectControl
                              className="w-36"
                              value={exam.status}
                              disabled={busyId === exam.id}
                              aria-label={t("admin.settings.statusFor", { title: exam.title })}
                              onChange={(event) => {
                                const next = event.target.value as AdminExamStatus;
                                if (next === "CANCELLED") setCancelTarget(exam);
                                else void changeStatus(exam, next);
                              }}
                            >
                              {!ADMIN_EXAM_STATUSES.includes(exam.status as AdminExamStatus) ? (
                                <option value={exam.status}>{exam.status}</option>
                              ) : null}
                              {ADMIN_EXAM_STATUSES.map((value) => (
                                <option key={value} value={value}>
                                  {statusLabel(value)}
                                </option>
                              ))}
                            </SelectControl>
                          </div>
                        </td>
                      </tr>
                      {editingId === exam.id ? (
                        <tr className="bg-muted/30">
                          <td colSpan={6} className="px-3 py-3">
                            <form
                              className="flex flex-col gap-3 sm:flex-row sm:items-end"
                              onSubmit={(event) => void saveSchedule(event, exam.id)}
                            >
                              <label className="grid gap-1.5 text-sm" htmlFor={`exam-at-${exam.id}`}>
                                <span className="font-medium">{copy.scheduleAt}</span>
                                <Input
                                  id={`exam-at-${exam.id}`}
                                  type="datetime-local"
                                  value={scheduledAt}
                                  onChange={(event) => setScheduledAt(event.target.value)}
                                />
                              </label>
                              <label className="grid gap-1.5 text-sm" htmlFor={`exam-duration-${exam.id}`}>
                                <span className="font-medium">{copy.duration}</span>
                                <Input
                                  id={`exam-duration-${exam.id}`}
                                  type="number"
                                  min={1}
                                  max={600}
                                  className="sm:w-32"
                                  value={duration}
                                  onChange={(event) => setDuration(event.target.value)}
                                />
                              </label>
                              <div className="flex gap-2">
                                <Button type="submit" size="sm" disabled={savingSchedule}>
                                  {savingSchedule ? copy.saving : copy.saveSchedule}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingId(null)}
                                >
                                  {copy.cancel}
                                </Button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </TableScroller>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={cancelTarget !== null}
        title={copy.confirmCancelTitle}
        description={cancelTarget ? t("admin.settings.confirmCancel", { title: cancelTarget.title }) : undefined}
        confirmLabel={copy.confirmCancelAction}
        cancelLabel={copy.keep}
        destructive
        confirming={busyId !== null}
        onConfirm={() => {
          if (cancelTarget) void changeStatus(cancelTarget, "CANCELLED");
        }}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
