"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarClockIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, LoadingSkeleton, PageHeader } from "@/components/admin/ui/dashboard-ui";
import { SelectControl } from "@/components/admin/ui/controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  examStatusCounts,
  examStatusPresentation,
  fetchAdminStats,
  parseAdminStats,
  type AdminStats,
  type CountedExamStatus,
} from "@/lib/admin/dashboard";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import { ENGLISH_VOICES, ZEROTTS_VOICES } from "@/lib/tts-service";
import type { User } from "@/lib/types";
import { cn } from "cn";

type Subject = { id: string; code: string; name: string; teacherIds: string[] };
type Tab = "schedule" | "config";
type Speech = { sttLanguage: string; ttsLanguage: string; ttsVoice: string; ttsVoiceEn: string };

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
      setReloadKey((current) => current + 1);
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
      setReloadKey((current) => current + 1);
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : copy.assignError);
    } finally {
      setAssigningId(null);
    }
  }

  async function unassign(subject: Subject, teacherId: string) {
    const name = teacherName(teacherId) ?? copy.unknownTeacher;
    if (!window.confirm(t("admin.settings.unassignConfirm", { teacher: name, subject: subject.code }))) return;
    setAssigningId(subject.id);
    try {
      await api(`/api/admin/subjects/${subject.id}/teachers/${teacherId}`, { method: "DELETE", auth: true });
      toast.success(copy.unassigned);
      setReloadKey((current) => current + 1);
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : copy.unassignError);
    } finally {
      setAssigningId(null);
    }
  }

  const teacherName = (id: string) => teachers.find((teacher) => teacher.id === id)?.name;

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
      {tab === "config" ? <SpeechSettings /> : null}
      {error && subjects === null ? (
        <ErrorState
          title={copy.loadError}
          message={error}
          retryLabel={copy.retry}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      ) : subjects === null ? (
        <LoadingSkeleton className="h-64 w-full" label={copy.loading} />
      ) : (
        <>
          {error ? (
            <ErrorState
              title={copy.loadError}
              message={error}
              retryLabel={copy.retry}
              onRetry={() => setReloadKey((current) => current + 1)}
            />
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
                    return (
                      <li
                        key={subject.id}
                        className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1.5">
                          <p className="font-medium">
                            {subject.code} — {subject.name}
                          </p>
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
                                  className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 ring-inset"
                                >
                                  {teacherName(id) ?? copy.unknownTeacher}
                                  <button
                                    type="button"
                                    className="inline-flex size-4 items-center justify-center rounded-full hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
                                    aria-label={t("admin.settings.unassignTeacher", {
                                      teacher: teacherName(id) ?? copy.unknownTeacher,
                                    })}
                                    disabled={assigningId === subject.id}
                                    onClick={() => void unassign(subject, id)}
                                  >
                                    <XIcon className="size-3" aria-hidden />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <SelectControl
                          className="w-full sm:w-56"
                          value=""
                          aria-label={copy.assignTeacher}
                          disabled={available.length === 0 || assigningId === subject.id}
                          onChange={(event) => void assign(subject.id, event.target.value)}
                        >
                          <option value="">{copy.assignTeacher}</option>
                          {available.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.name}
                            </option>
                          ))}
                        </SelectControl>
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
    </div>
  );
}

const ZERO_ENGLISH_VOICES = ENGLISH_VOICES.filter((voice) => voice.engine === "zerotts");
const BROWSER_ENGLISH_VOICES = ENGLISH_VOICES.filter((voice) => voice.engine === "browser");

function knownVoice(id: string | undefined, voices: readonly { id: string }[], fallback: string) {
  return id && voices.some((voice) => voice.id === id) ? id : fallback;
}

function SpeechSettings() {
  const { messages } = useLocale();
  const copy = messages.admin.settings;
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api<Speech>("/api/admin/speech", { auth: true, signal: controller.signal, cache: "no-store" })
      .then((next) => {
        if (controller.signal.aborted) return;
        setSpeech({
          sttLanguage: next.sttLanguage === "en" ? "en" : "vi",
          ttsLanguage: next.ttsLanguage === "en" ? "en" : "vi",
          ttsVoice: knownVoice(next.ttsVoice, ZEROTTS_VOICES, "maichi"),
          ttsVoiceEn: knownVoice(next.ttsVoiceEn, ENGLISH_VOICES, "maichi"),
        });
        setError(null);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof ApiError ? reason.message : copy.loadError);
      });
    return () => controller.abort();
  }, [reloadKey, copy.loadError]);

  async function saveSpeech(event: FormEvent) {
    event.preventDefault();
    if (!speech) return;
    setSaving(true);
    try {
      const saved = await api<Speech>("/api/admin/speech", {
        method: "PATCH",
        auth: true,
        body: speech,
      });
      setSpeech({
        sttLanguage: saved.sttLanguage === "en" ? "en" : "vi",
        ttsLanguage: saved.ttsLanguage === "en" ? "en" : "vi",
        ttsVoice: knownVoice(saved.ttsVoice, ZEROTTS_VOICES, "maichi"),
        ttsVoiceEn: knownVoice(saved.ttsVoiceEn, ENGLISH_VOICES, "maichi"),
      });
      toast.success(copy.saved);
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : copy.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="border-b">
        <CardTitle className="font-serif text-2xl">{copy.speechTitle}</CardTitle>
        <CardDescription>{copy.speechDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {error && speech === null ? (
          <ErrorState
            title={copy.loadError}
            message={error}
            retryLabel={copy.retry}
            onRetry={() => setReloadKey((current) => current + 1)}
          />
        ) : speech === null ? (
          <LoadingSkeleton className="h-40 w-full" label={copy.loading} />
        ) : (
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void saveSpeech(event)}>
            <div className="grid gap-1.5">
              <Label htmlFor="speech-stt">{copy.stt}</Label>
              <SelectControl
                id="speech-stt"
                value={speech.sttLanguage}
                onChange={(event) => setSpeech((current) => current && { ...current, sttLanguage: event.target.value })}
              >
                <option value="vi">{copy.vietnamese}</option>
                <option value="en">{copy.english}</option>
              </SelectControl>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="speech-tts">{copy.tts}</Label>
              <SelectControl
                id="speech-tts"
                value={speech.ttsLanguage}
                onChange={(event) => setSpeech((current) => current && { ...current, ttsLanguage: event.target.value })}
              >
                <option value="vi">{copy.vietnamese}</option>
                <option value="en">{copy.english}</option>
              </SelectControl>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="speech-voice-vi">{copy.ttsVoice}</Label>
              <SelectControl
                id="speech-voice-vi"
                value={speech.ttsVoice}
                onChange={(event) => setSpeech((current) => current && { ...current, ttsVoice: event.target.value })}
              >
                {ZEROTTS_VOICES.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label}
                  </option>
                ))}
              </SelectControl>
              <p className="text-sm text-muted-foreground">{copy.ttsVoiceHint}</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="speech-voice-en">{copy.ttsVoiceEn}</Label>
              <SelectControl
                id="speech-voice-en"
                value={speech.ttsVoiceEn}
                onChange={(event) => setSpeech((current) => current && { ...current, ttsVoiceEn: event.target.value })}
              >
                <optgroup label={copy.ttsVoiceEnZero}>
                  {ZERO_ENGLISH_VOICES.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={copy.ttsVoiceEnBrowser}>
                  {BROWSER_ENGLISH_VOICES.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                    </option>
                  ))}
                </optgroup>
              </SelectControl>
              <p className="text-sm text-muted-foreground">{copy.ttsVoiceEnHint}</p>
            </div>
            <Button type="submit" className="sm:col-span-2 sm:w-fit" disabled={saving}>
              {saving ? copy.saving : copy.save}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

const STATUS_LABEL_KEY = {
  SCHEDULED: "scheduled",
  IN_PROGRESS: "inProgress",
  COMPLETED: "completed",
} as const satisfies Record<CountedExamStatus, string>;

function ExamSchedule() {
  const { t, messages } = useLocale();
  const copy = messages.admin.settings;
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchAdminStats(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setStats(parseAdminStats(value));
        setError(null);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof ApiError ? reason.message : copy.scheduleLoadError);
      });
    return () => controller.abort();
  }, [reloadKey, copy.scheduleLoadError]);

  return (
    <div className="space-y-8">
      <Card className="min-w-0">
        <CardHeader className="border-b">
          <CardTitle className="font-serif text-2xl">{copy.scheduleTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && stats === null ? (
            <ErrorState
              title={copy.scheduleLoadError}
              message={error}
              retryLabel={copy.retry}
              onRetry={() => setReloadKey((current) => current + 1)}
            />
          ) : stats === null ? (
            <LoadingSkeleton className="h-28 w-full" label={copy.loading} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-3">
              {examStatusCounts(stats).map((row) => (
                <li key={row.status} className="rounded-2xl bg-card p-5 shadow-soft ring-1 ring-foreground/[0.07]">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span
                      className={cn("size-2 rounded-full", examStatusPresentation(row.status).barClass)}
                      aria-hidden
                    />
                    {copy[STATUS_LABEL_KEY[row.status]]}
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
        <CardContent>
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted">
              <CalendarClockIcon className="size-5 text-muted-foreground" aria-hidden />
            </span>
            <div className="space-y-1">
              <p className="font-medium">{copy.sessionsEmptyTitle}</p>
            </div>
          </div>
        </CardContent>
      </Card>
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
