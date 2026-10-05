"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";

type Session = {
  id: string;
  title: string;
  format: string;
  subjectName: string;
  teacherName: string;
  entered: boolean;
  score: number | null;
};

type Question = { id: string; prompt: string; bloom: string; criteria: string; maxScore: number };

export function StudentTests() {
  const { t } = useLocale();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  function load() {
    api<Session[]>("/api/student/exams", { auth: true })
      .then(setSessions)
      .catch((error) => {
        toast.error(error instanceof ApiError ? error.message : "Could not load tests.");
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function enter(id: string) {
    try {
      await api(`/api/student/exams/${id}/enter`, { method: "POST", auth: true });
      const next = await api<Question[]>(`/api/student/exams/${id}/questions`, { auth: true });
      setOpenId(id);
      setQuestions(next);
      load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not enter that test.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {t("student.tests.eyebrow")}
        </p>
        <h1 className="font-serif text-4xl tracking-tight">{t("student.tests.title")}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t("student.tests.lead")}</p>
      </section>
      <ul className="space-y-4">
        {sessions.map((session) => (
          <li key={session.id}>
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="font-serif text-2xl">{session.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {session.teacherName} · {session.subjectName} ·{" "}
                  {session.format === "ORAL"
                    ? t("student.tests.oral")
                    : t("student.tests.multipleChoice")}
                  {session.score != null ? ` · ${t("student.tests.score")} ${session.score}` : ""}
                </p>
                <Button type="button" onClick={() => void enter(session.id)}>
                  {session.entered ? t("student.tests.open") : t("student.tests.enter")}
                </Button>
              </CardContent>
              {openId === session.id ? (
                <ul className="divide-y border-t">
                  {questions.length === 0 ? (
                    <li className="px-6 py-4 text-sm text-muted-foreground">
                      {t("student.tests.noQuestions")}
                    </li>
                  ) : (
                    questions.map((question) => (
                      <li key={question.id} className="space-y-1 px-6 py-4">
                        <p className="font-medium">{question.prompt}</p>
                        <p className="text-sm text-muted-foreground">
                          {question.bloom} · {question.criteria} · max {question.maxScore}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
