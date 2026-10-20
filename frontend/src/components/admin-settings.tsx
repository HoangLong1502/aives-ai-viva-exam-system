"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { ENGLISH_VOICES, ZEROTTS_VOICES } from "@/lib/tts-service";
import type { User } from "@/lib/types";

type Subject = { id: string; code: string; name: string; teacherIds: string[] };
type Speech = { sttLanguage: string; ttsLanguage: string; ttsVoice: string; ttsVoiceEn: string };

export function AdminSettings() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [speech, setSpeech] = useState<Speech>({
    sttLanguage: "vi",
    ttsLanguage: "vi",
    ttsVoice: "maichi",
    ttsVoiceEn: "maichi",
  });
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  function load() {
    Promise.all([
      api<Subject[]>("/api/admin/subjects", { auth: true }),
      api<User[]>("/api/users", { auth: true }),
      api<Speech>("/api/admin/speech", { auth: true }),
    ])
      .then(([nextSubjects, people, nextSpeech]) => {
        setSubjects(nextSubjects);
        setTeachers(people.filter((person) => person.role === "EXAMINER"));
        setSpeech({
          sttLanguage: nextSpeech.sttLanguage || "vi",
          ttsLanguage: nextSpeech.ttsLanguage || "vi",
          ttsVoice: nextSpeech.ttsVoice || "maichi",
          ttsVoiceEn: nextSpeech.ttsVoiceEn || "maichi",
        });
      })
      .catch((error) => {
        toast.error(error instanceof ApiError ? error.message : "Could not load settings.");
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function createSubject(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/api/admin/subjects", { method: "POST", auth: true, body: { code, name } });
      setCode("");
      setName("");
      load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not add that subject.");
    }
  }

  async function assign(subjectId: string, teacherId: string) {
    if (!teacherId) return;
    try {
      await api("/api/admin/subjects/teachers", {
        method: "POST",
        auth: true,
        body: { subjectId, teacherId },
      });
      toast.success("Teacher assigned.");
      load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not assign that teacher.");
    }
  }

  async function saveSpeech(event: FormEvent) {
    event.preventDefault();
    try {
      const saved = await api<Speech>("/api/admin/speech", {
        method: "PATCH",
        auth: true,
        body: speech,
      });
      setSpeech(saved);
      toast.success("Speech language saved.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save languages.");
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Settings</p>
        <h1 className="font-serif text-4xl tracking-tight">Subjects and speech</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Assign teachers to subjects, and choose Vietnamese or English for speech recognition and speech synthesis.
        </p>
      </section>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="font-serif text-2xl">Subjects</CardTitle>
          <CardDescription>A teacher only sees the subjects you assign.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={createSubject}>
            <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Code" required />
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Subject name" required />
            <Button type="submit">Add</Button>
          </form>
          <ul className="divide-y rounded-xl border">
            {subjects.map((subject) => (
              <li key={subject.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{subject.code} — {subject.name}</p>
                  <p className="text-sm text-muted-foreground">{subject.teacherIds.length} teachers assigned</p>
                </div>
                <select
                  className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                  defaultValue=""
                  onChange={(event) => void assign(subject.id, event.target.value)}
                >
                  <option value="">Assign a teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="font-serif text-2xl">STT and TTS</CardTitle>
          <CardDescription>Used when a viva listens and speaks.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveSpeech}>
            <label className="space-y-1 text-sm">
              <span>Speech to text</span>
              <select className="h-9 w-full rounded-lg border border-input bg-background px-2" value={speech.sttLanguage} onChange={(event) => setSpeech((current) => ({ ...current, sttLanguage: event.target.value }))}>
                <option value="vi">Vietnamese</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Text to speech</span>
              <select className="h-9 w-full rounded-lg border border-input bg-background px-2" value={speech.ttsLanguage} onChange={(event) => setSpeech((current) => ({ ...current, ttsLanguage: event.target.value }))}>
                <option value="vi">Vietnamese</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Vietnamese voice (ZeroTTS)</span>
              <select className="h-9 w-full rounded-lg border border-input bg-background px-2" value={speech.ttsVoice} onChange={(event) => setSpeech((current) => ({ ...current, ttsVoice: event.target.value }))}>
                {ZEROTTS_VOICES.map((voice) => (
                  <option key={voice.id} value={voice.id}>{voice.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>English voice</span>
              <select className="h-9 w-full rounded-lg border border-input bg-background px-2" value={speech.ttsVoiceEn} onChange={(event) => setSpeech((current) => ({ ...current, ttsVoiceEn: event.target.value }))}>
                {ENGLISH_VOICES.map((voice) => (
                  <option key={voice.id} value={voice.id}>{voice.label}</option>
                ))}
              </select>
            </label>
            <Button type="submit" className="sm:col-span-2 sm:w-fit">Save speech settings</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
