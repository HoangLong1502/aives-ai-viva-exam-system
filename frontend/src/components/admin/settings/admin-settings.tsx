"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { ExamSchedule } from "@/components/admin/settings/exam-schedule";
import { ErrorState, LoadingSkeleton, PageHeader } from "@/components/admin/ui/dashboard-ui";
import { SelectControl } from "@/components/admin/ui/controls";
import { ConfirmDialog } from "@/components/teacher/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import { ENGLISH_VOICES, ZEROTTS_VOICES } from "@/lib/tts-service";
import type { User } from "@/lib/types";
import { cn } from "cn";

type Subject = { id: string; code: string; name: string; teacherIds: string[] };
type Tab = "schedule" | "config";
type PendingAction =
  | { kind: "unassign"; subject: Subject; teacherId: string }
  | { kind: "delete"; subject: Subject };

export function AdminSettings() {
  const { t, messages } = useLocale();
  const copy = messages.admin.settings;
  const [tab, setTab] = useState<Tab>("schedule");
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ code?: string; name?: string }>({});
  const [savingSubject, setSavingSubject] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback((signal: AbortSignal) => {
    return Promise.all([
      api<Subject[]>("/api/admin/subjects", { auth: true, signal, cache: "no-store" }),
      api<User[]>("/api/users", { auth: true, signal, cache: "no-store" }),
    ]);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then(([nextSubjects, people]) => {
        if (controller.signal.aborted) return;
        setSubjects(nextSubjects);
        setTeachers(people.filter((person) => person.role === "EXAMINER"));
        setError(null);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof ApiError ? reason.message : copy.loadError);
      });
    return () => controller.abort();
  }, [load, reloadKey, copy.loadError]);

  const reload = () => setReloadKey((current) => current + 1);

  async function createSubject(event: FormEvent) {
    event.preventDefault();
    const nextErrors: { code?: string; name?: string } = {};
    if (!code.trim()) nextErrors.code = copy.required;
    if (!name.trim()) nextErrors.name = copy.required;
    setFieldErrors(nextErrors);
    if (nextErrors.code || nextErrors.name) return;

    setSavingSubject(true);
    try {
      await api("/api/admin/subjects", {
        method: "POST",
        auth: true,
        body: { code: code.trim(), name: name.trim() },
      });
      setCode("");
      setName("");
      setFieldErrors({});
      reload();
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : copy.addError);
    } finally {
      setSavingSubject(false);
    }
  }

  async function assign(subjectId: string, teacherId: string) {
    if (!teacherId) return;
    setAssigningId(subjectId);
    try {
      await api("/api/admin/subjects/teachers", {
        method: "POST",
        auth: true,
        body: { subjectId, teacherId },
      });
      toast.success(copy.assigned);
      reload();
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : copy.assignError);
    } finally {
      setAssigningId(null);
    }
  }

  function startEditing(subject: Subject) {
    setEditingId(subject.id);
    setEditCode(subject.code);
    setEditName(subject.name);
  }

  async function saveEdit(event: FormEvent, subjectId: string) {
    event.preventDefault();
    if (!editCode.trim() || !editName.trim()) {
      toast.error(copy.required);
      return;
    }
    setSavingEdit(true);
    try {
      await api(`/api/admin/subjects/${subjectId}`, {
        method: "PATCH",
        auth: true,
        body: { code: editCode.trim(), name: editName.trim() },
      });
      toast.success(copy.subjectUpdated);
      setEditingId(null);
      reload();
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : copy.updateError);
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmPending() {
    if (!pending) return;
    setConfirming(true);
    try {
      // Cùng một hộp thoại xác nhận xử lý cả gỡ phân công lẫn xóa môn học.
      if (pending.kind === "unassign") {
        await api(`/api/admin/subjects/${pending.subject.id}/teachers/${pending.teacherId}`, {
          method: "DELETE",
          auth: true,
        });
        toast.success(copy.unassigned);
      } else {
        await api(`/api/admin/subjects/${pending.subject.id}`, { method: "DELETE", auth: true });
        toast.success(copy.subjectDeleted);
      }
      reload();
    } catch (reason) {
      const fallback = pending.kind === "unassign" ? copy.unassignError : copy.deleteError;
      toast.error(reason instanceof ApiError ? reason.message : fallback);
    } finally {
      setConfirming(false);
      setPending(null);
    }
  }

  const teacherName = (id: string) => teachers.find((teacher) => teacher.id === id)?.name ?? copy.unknownTeacher;

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader title={copy.title} />

      <div
        role="tablist"
        aria-label={copy.tabsLabel}
        className="flex w-fit gap-1 rounded-lg bg-muted p-1"
        onKeyDown={(event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
          const current = tabs.findIndex((tabButton) => tabButton === document.activeElement);
          if (current < 0) return;
          const nextIndex =
            event.key === "ArrowRight"
              ? (current + 1) % tabs.length
              : (current - 1 + tabs.length) % tabs.length;
          tabs[nextIndex]?.focus();
          tabs[nextIndex]?.click();
        }}
      >
        <TabButton
          selected={tab === "schedule"}
          controls="settings-schedule"
          onSelect={() => setTab("schedule")}
        >
          {copy.scheduleTab}
        </TabButton>
        <TabButton
          selected={tab === "config"}
          controls="settings-config"
          onSelect={() => setTab("config")}
        >
          {copy.configTab}
        </TabButton>
      </div>

      <div id="settings-schedule" role="tabpanel" hidden={tab !== "schedule"}>
        {tab === "schedule" ? <ExamSchedule /> : null}
      </div>

      <div id="settings-config" role="tabpanel" hidden={tab !== "config"} className="space-y-8">
        {error && subjects === null ? (
          <ErrorState title={copy.loadError} message={error} retryLabel={copy.retry} onRetry={reload} />
        ) : subjects === null ? (
          <LoadingSkeleton className="h-64 w-full" label={copy.loading} />
        ) : (
          <>
            {error ? (
              <ErrorState title={copy.loadError} message={error} retryLabel={copy.retry} onRetry={reload} />
            ) : null}
            <Card className="min-w-0">
              <CardHeader className="border-b">
                <CardTitle className="font-serif text-2xl">{copy.subjectsTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start" onSubmit={createSubject}>
                  <div className="grid gap-1.5">
                    <Label htmlFor="subject-code">{copy.codeLabel}</Label>
                    <Input
                      id="subject-code"
                      value={code}
                      aria-invalid={Boolean(fieldErrors.code)}
                      placeholder={copy.codePlaceholder}
                      onChange={(event) => {
                        setCode(event.target.value);
                        setFieldErrors((current) => ({ ...current, code: undefined }));
                      }}
                    />
                    {fieldErrors.code ? <p className="text-sm text-destructive">{fieldErrors.code}</p> : null}
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="subject-name">{copy.nameLabel}</Label>
                    <Input
                      id="subject-name"
                      value={name}
                      aria-invalid={Boolean(fieldErrors.name)}
                      placeholder={copy.namePlaceholder}
                      onChange={(event) => {
                        setName(event.target.value);
                        setFieldErrors((current) => ({ ...current, name: undefined }));
                      }}
                    />
                    {fieldErrors.name ? <p className="text-sm text-destructive">{fieldErrors.name}</p> : null}
                  </div>
                  <Button type="submit" className="sm:mt-6" disabled={savingSubject}>
                    {savingSubject ? copy.saving : copy.add}
                  </Button>
                </form>
                {subjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{copy.emptySubjects}</p>
                ) : (
                  <ul className="divide-y rounded-xl border">
                    {subjects.map((subject) => {
                      const available = teachers.filter((teacher) => !subject.teacherIds.includes(teacher.id));
                      const editing = editingId === subject.id;
                      return (
                        <li
                          key={subject.id}
                          className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="min-w-0 flex-1 space-y-1.5">
                            {editing ? (
                              <form
                                className="flex flex-col gap-2 sm:flex-row sm:items-center"
                                onSubmit={(event) => void saveEdit(event, subject.id)}
                              >
                                <Input
                                  value={editCode}
                                  aria-label={copy.codeLabel}
                                  className="sm:w-32"
                                  onChange={(event) => setEditCode(event.target.value)}
                                />
                                <Input
                                  value={editName}
                                  aria-label={copy.nameLabel}
                                  className="sm:max-w-xs"
                                  onChange={(event) => setEditName(event.target.value)}
                                />
                                <div className="flex gap-2">
                                  <Button type="submit" size="sm" disabled={savingEdit}>
                                    {savingEdit ? copy.saving : copy.saveSubject}
                                  </Button>
                                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                    {copy.cancel}
                                  </Button>
                                </div>
                              </form>
                            ) : (
                              <p className="font-medium">
                                {subject.code} — {subject.name}
                              </p>
                            )}
                            {subject.teacherIds.length === 0 ? (
                              <p className="text-sm text-muted-foreground">{copy.noTeacher}</p>
                            ) : (
                              <ul
                                className="flex flex-wrap gap-1.5"
                                aria-label={t("admin.settings.teachersAssigned", {
                                  count: String(subject.teacherIds.length),
                                })}
                              >
                                {subject.teacherIds.map((id) => (
                                  <li
                                    key={id}
                                    className="inline-flex items-center gap-1 rounded-md bg-muted py-0.5 pr-1 pl-2 text-xs font-medium text-muted-foreground"
                                  >
                                    {teacherName(id)}
                                    <button
                                      type="button"
                                      className="rounded-sm p-0.5 hover:bg-foreground/10 hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                                      aria-label={t("admin.settings.unassignTeacher", {
                                        name: teacherName(id),
                                        subject: subject.code,
                                      })}
                                      onClick={() => setPending({ kind: "unassign", subject, teacherId: id })}
                                    >
                                      <XIcon className="size-3" aria-hidden />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <SelectControl
                              className="w-full lg:w-56"
                              value=""
                              aria-label={copy.assignTeacher}
                              disabled={available.length === 0 || assigningId === subject.id}
                              onChange={(event) => void assign(subject.id, event.target.value)}
                            >
                              <option value="">
                                {available.length === 0 ? copy.allAssigned : copy.assignTeacher}
                              </option>
                              {available.map((teacher) => (
                                <option key={teacher.id} value={teacher.id}>
                                  {teacher.name}
                                </option>
                              ))}
                            </SelectControl>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label={t("admin.settings.editSubject", { code: subject.code })}
                              title={t("admin.settings.editSubject", { code: subject.code })}
                              onClick={() => (editing ? setEditingId(null) : startEditing(subject))}
                            >
                              <PencilIcon aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              aria-label={t("admin.settings.deleteSubject", { code: subject.code })}
                              title={t("admin.settings.deleteSubject", { code: subject.code })}
                              onClick={() => setPending({ kind: "delete", subject })}
                            >
                              <Trash2Icon aria-hidden />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === "delete" ? copy.confirmDeleteTitle : copy.confirmUnassignTitle}
        description={
          pending?.kind === "delete"
            ? t("admin.settings.confirmDelete", { subject: `${pending.subject.code} — ${pending.subject.name}` })
            : pending
              ? t("admin.settings.confirmUnassign", {
                  name: teacherName(pending.teacherId),
                  subject: pending.subject.code,
                })
              : undefined
        }
        confirmLabel={pending?.kind === "delete" ? copy.confirmDeleteAction : copy.confirmUnassignAction}
        cancelLabel={copy.cancel}
        destructive
        confirming={confirming}
        onConfirm={() => void confirmPending()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

function TabButton({
  selected,
  controls,
  onSelect,
  children,
}: {
  selected: boolean;
  controls: string;
  onSelect: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={controls}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
