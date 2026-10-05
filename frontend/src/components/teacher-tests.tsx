"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";

type Subject = { id: string; name: string; code: string };
type Rubric = { id: string; name: string; criteria: string; maxScore: number };
type Question = {
  id: string;
  subjectId: string;
  prompt: string;
  status: string;
  bloom: string;
  topic: string;
  source: string;
  sourceRef: string | null;
};

const BLOOM = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE"] as const;

export function TeacherTests() {
  const { t } = useLocale();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [rubricId, setRubricId] = useState("");
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState("ORAL");
  const [topic, setTopic] = useState("Oral reasoning");
  const [bloom, setBloom] = useState<(typeof BLOOM)[number]>("UNDERSTAND");
  const [count, setCount] = useState(3);
  const [selected, setSelected] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);

  async function reload() {
    const [nextSubjects, nextRubrics, nextQuestions] = await Promise.all([
      api<Subject[]>("/api/teaching/subjects", { auth: true }),
      api<Rubric[]>("/api/teaching/rubrics", { auth: true }),
      api<Question[]>("/api/teaching/questions", { auth: true }),
    ]);
    setSubjects(nextSubjects);
    setRubrics(nextRubrics);
    setQuestions(nextQuestions);
    setSubjectId((current) => current || nextSubjects[0]?.id || "");
    setRubricId((current) => current || nextRubrics[0]?.id || "");
  }

  useEffect(() => {
    reload().catch((error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not load tests.");
    });
  }, []);

  const forSubject = useMemo(
    () => questions.filter((question) => !subjectId || question.subjectId === subjectId),
    [questions, subjectId],
  );
  const pending = forSubject.filter((question) => question.status === "PENDING_REVIEW");
  const approved = forSubject.filter((question) => question.status === "APPROVED");

  useEffect(() => {
    setSelected([]);
  }, [subjectId]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function onGenerate() {
    if (!subjectId || !rubricId) {
      toast.error("Choose a subject and rubric first.");
      return;
    }
    setGenerating(true);
    try {
      const created = await api<Question[]>("/api/teaching/questions/generate", {
        method: "POST",
        auth: true,
        body: { subjectId, rubricId, topic, bloom, count },
      });
      toast.success(`${created.length} drafts ready to review.`);
      await reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not draft questions.");
    } finally {
      setGenerating(false);
    }
  }

  async function review(question: Question, status: string) {
    const nextPrompt = edits[question.id] ?? question.prompt;
    try {
      const updated = await api<Question>(`/api/teaching/questions/${question.id}`, {
        method: "PATCH",
        auth: true,
        body: { prompt: nextPrompt, bloom: question.bloom, status },
      });
      setQuestions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEdits((current) => {
        const next = { ...current };
        delete next[question.id];
        return next;
      });
      if (status === "APPROVED") {
        setSelected((current) => (current.includes(updated.id) ? current : [...current, updated.id]));
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not update that question.");
    }
  }

  async function onStart(event: FormEvent) {
    event.preventDefault();
    if (selected.length === 0) {
      toast.error("Select at least one approved question.");
      return;
    }
    try {
      await api("/api/teaching/exams", {
        method: "POST",
        auth: true,
        body: { title, format, subjectId, questionIds: selected },
      });
      setTitle("");
      setSelected([]);
      toast.success("The test is in progress.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not start the test.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {t("teacher.tests.eyebrow")}
        </p>
        <h1 className="font-serif text-4xl tracking-tight">{t("teacher.tests.title")}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t("teacher.tests.lead")}</p>
      </section>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="font-serif text-2xl">{t("teacher.tests.draftTitle")}</CardTitle>
          <CardDescription>{t("teacher.tests.draftDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
            >
              {subjects.length === 0 ? (
                <option value="">{t("teacher.tests.noSubjects")}</option>
              ) : null}
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} — {subject.name}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
              value={rubricId}
              onChange={(event) => setRubricId(event.target.value)}
            >
              {rubrics.length === 0 ? <option value="">No rubrics yet</option> : null}
              {rubrics.map((rubric) => (
                <option key={rubric.id} value={rubric.id}>
                  {rubric.name}
                </option>
              ))}
            </select>
            <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" />
            <select
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
              value={bloom}
              onChange={(event) => setBloom(event.target.value as (typeof BLOOM)[number])}
            >
              {BLOOM.map((level) => (
                <option key={level} value={level}>
                  {level[0] + level.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => void onGenerate()}
              disabled={generating || !subjectId || !rubricId}
            >
              {generating ? "Drafting…" : `Draft ${count} from material`}
            </Button>
            <Input
              className="w-24"
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              aria-label="Number of questions"
            />
          </div>

          {pending.length > 0 ? (
            <ul className="divide-y rounded-xl border">
              {pending.map((question) => (
                <li key={question.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    <span>Pending review</span>
                    <span>{question.bloom}</span>
                    <span>{question.topic}</span>
                  </div>
                  <textarea
                    value={edits[question.id] ?? question.prompt}
                    onChange={(event) =>
                      setEdits((current) => ({ ...current, [question.id]: event.target.value }))
                    }
                    className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    {question.sourceRef ? question.sourceRef : "Generated from course material"}
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => void review(question, "APPROVED")}>
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void review(question, "REJECTED")}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="font-serif text-2xl">New session</CardTitle>
          <CardDescription>Pick approved questions for this subject, then open the session.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onStart}>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Session title"
              required
            />
            <div className="grid gap-3 md:grid-cols-2">
              <select
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} — {subject.name}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                value={format}
                onChange={(event) => setFormat(event.target.value)}
              >
                <option value="ORAL">Oral</option>
                <option value="MULTIPLE_CHOICE">Multiple choice</option>
              </select>
            </div>
            <ul className="space-y-2">
              {approved.length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  No approved questions for this subject yet. Draft from material or add them in the question bank.
                </li>
              ) : (
                approved.map((question) => (
                  <li key={question.id}>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected.includes(question.id)}
                        onChange={() => toggle(question.id)}
                      />
                      <span>
                        <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                          {question.bloom}
                        </span>
                        <br />
                        {question.prompt}
                      </span>
                    </label>
                  </li>
                ))
              )}
            </ul>
            <Button type="submit" disabled={!subjectId || selected.length === 0}>
              Start test
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
