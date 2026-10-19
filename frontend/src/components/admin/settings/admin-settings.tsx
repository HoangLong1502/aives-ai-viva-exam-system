"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ErrorState, LoadingSkeleton, PageHeader } from "@/components/admin/ui/dashboard-ui";
import { SelectControl } from "@/components/admin/ui/controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import { ENGLISH_VOICES, ZEROTTS_VOICES } from "@/lib/tts-service";
import type { User } from "@/lib/types";

type Subject = { id: string; code: string; name: string; teacherIds: string[] };
type Speech = { sttLanguage: string; ttsLanguage: string; ttsVoice: string; ttsVoiceEn: string };

export function AdminSettings() {
  const { t, messages } = useLocale();
  const copy = messages.admin.settings;
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [speech, setSpeech] = useState<Speech>({
    sttLanguage: "vi",
    ttsLanguage: "vi",
    ttsVoice: "maichi",
    ttsVoiceEn: "maichi",
  });
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ code?: string; name?: string }>({});
  const [savingSubject, setSavingSubject] = useState(false);
  const [savingSpeech, setSavingSpeech] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const load = useCallback((signal: AbortSignal) => {
    return Promise.all([
      api<Subject[]>("/api/admin/subjects", { auth: true, signal, cache: "no-store" }),
      api<User[]>("/api/users", { auth: true, signal, cache: "no-store" }),
      api<Speech>("/api/admin/speech", { auth: true, signal, cache: "no-store" }),
    ]);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then(([nextSubjects, people, nextSpeech]) => {
        if (controller.signal.aborted) return;
        setSubjects(nextSubjects);
        setTeachers(people.filter((person) => person.role === "EXAMINER"));
        setSpeech({
          sttLanguage: nextSpeech.sttLanguage || "vi",
          ttsLanguage: nextSpeech.ttsLanguage || "vi",
          ttsVoice: nextSpeech.ttsVoice || "maichi",
          ttsVoiceEn: nextSpeech.ttsVoiceEn || "maichi",
        });
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

  async function saveSpeech(event: FormEvent) {
    event.preventDefault();
    setSavingSpeech(true);
    try {
      const saved = await api<Speech>("/api/admin/speech", {
        method: "PATCH",
        auth: true,
        body: speech,
      });
      setSpeech(saved);
      toast.success(copy.saved);
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : copy.saveError);
    } finally {
      setSavingSpeech(false);
    }
  }

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.lead} />

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
              <CardDescription>{copy.subjectsDescription}</CardDescription>
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
                        <div>
                          <p className="font-medium">
                            {subject.code} — {subject.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t("admin.settings.teachersAssigned", { count: String(subject.teacherIds.length) })}
                          </p>
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

          <Card className="min-w-0">
            <CardHeader className="border-b">
              <CardTitle className="font-serif text-2xl">{copy.speechTitle}</CardTitle>
              <CardDescription>{copy.speechDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveSpeech}>
                <label className="grid gap-1.5 text-sm" htmlFor="speech-stt">
                  <span className="font-medium">{copy.stt}</span>
                  <SelectControl
                    id="speech-stt"
                    value={speech.sttLanguage}
                    onChange={(event) =>
                      setSpeech((current) => ({ ...current, sttLanguage: event.target.value }))
                    }
                  >
                    <option value="vi">{copy.vietnamese}</option>
                    <option value="en">{copy.english}</option>
                  </SelectControl>
                </label>
                <label className="grid gap-1.5 text-sm" htmlFor="speech-tts">
                  <span className="font-medium">{copy.tts}</span>
                  <SelectControl
                    id="speech-tts"
                    value={speech.ttsLanguage}
                    onChange={(event) =>
                      setSpeech((current) => ({ ...current, ttsLanguage: event.target.value }))
                    }
                  >
                    <option value="vi">{copy.vietnamese}</option>
                    <option value="en">{copy.english}</option>
                  </SelectControl>
                </label>
                <label className="grid gap-1.5 text-sm" htmlFor="speech-voice">
                  <span className="font-medium">{copy.ttsVoice}</span>
                  <SelectControl
                    id="speech-voice"
                    value={speech.ttsVoice}
                    onChange={(event) =>
                      setSpeech((current) => ({ ...current, ttsVoice: event.target.value }))
                    }
                  >
                    {ZEROTTS_VOICES.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.label}
                      </option>
                    ))}
                  </SelectControl>
                  <span className="text-xs text-muted-foreground">{copy.ttsVoiceHint}</span>
                </label>
                <label className="grid gap-1.5 text-sm" htmlFor="speech-voice-en">
                  <span className="font-medium">{copy.ttsVoiceEn}</span>
                  <SelectControl
                    id="speech-voice-en"
                    value={speech.ttsVoiceEn}
                    onChange={(event) =>
                      setSpeech((current) => ({ ...current, ttsVoiceEn: event.target.value }))
                    }
                  >
                    {ENGLISH_VOICES.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.label}
                      </option>
                    ))}
                  </SelectControl>
                  <span className="text-xs text-muted-foreground">{copy.ttsVoiceEnHint}</span>
                </label>
                <Button type="submit" className="sm:col-span-2 sm:w-fit" disabled={savingSpeech}>
                  {savingSpeech ? copy.saving : copy.save}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
