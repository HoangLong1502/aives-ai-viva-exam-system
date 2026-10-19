"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ErrorState, LoadingSkeleton, PageHeader } from "@/components/admin/ui/dashboard-ui";
import { SelectControl, TextArea } from "@/components/admin/ui/controls";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { fetchAdminSubjects, parseAdminSubjects, type AdminSubject } from "@/lib/admin/dashboard";
import { formatAdminDate } from "@/lib/admin/format";
import { useLocale } from "@/lib/i18n/locale-provider";

type Passage = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

export function AdminKnowledge() {
  const { t, locale, messages } = useLocale();
  const copy = messages.admin.knowledge;
  const [passages, setPassages] = useState<Passage[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<AdminSubject[] | null>(null);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ course?: string; title?: string; content?: string }>({});
  const [saving, setSaving] = useState(false);

  const loadPassages = useCallback((signal: AbortSignal) => {
    return api<Passage[]>("/api/knowledge", { auth: true, signal, cache: "no-store" });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadPassages(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setPassages(result);
        setListError(null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setListError(error instanceof ApiError ? error.message : copy.loadError);
      });
    return () => controller.abort();
  }, [loadPassages, reloadKey, copy.loadError]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAdminSubjects(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setSubjects(parseAdminSubjects(value));
        setSubjectError(null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setSubjectError(error instanceof ApiError ? error.message : copy.subjectsError);
      });
    return () => controller.abort();
  }, [copy.subjectsError, reloadKey]);

  const needle = query.trim().toLowerCase();
  const visible = (passages ?? []).filter((passage) =>
    needle ? `${passage.title} ${passage.content}`.toLowerCase().includes(needle) : true,
  );

  async function createPassage(event: FormEvent) {
    event.preventDefault();
    const nextErrors: { course?: string; title?: string; content?: string } = {};
    const nextTitle = title.trim();
    const nextContent = content.trim();
    if (!courseId) nextErrors.course = copy.required;
    if (!nextTitle) nextErrors.title = copy.required;
    else if (nextTitle.length > 200) nextErrors.title = copy.titleInvalid;
    if (!nextContent) nextErrors.content = copy.required;
    else if (nextContent.length > 8000) nextErrors.content = copy.contentInvalid;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await api("/api/knowledge", {
        method: "POST",
        auth: true,
        body: { courseId, title: nextTitle, content: nextContent },
      });
      setCourseId("");
      setTitle("");
      setContent("");
      setFieldErrors({});
      toast.success(copy.created);
      setReloadKey((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : copy.createError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.lead} />

      <Card className="min-w-0">
        <CardHeader className="border-b">
          <CardTitle className="font-serif text-2xl">{copy.createTitle}</CardTitle>
          <CardDescription>{copy.createLead}</CardDescription>
        </CardHeader>
        <CardContent>
          {subjectError && subjects === null ? (
            <ErrorState
              title={copy.subjectsError}
              message={subjectError}
              retryLabel={copy.retry}
              onRetry={() => setReloadKey((current) => current + 1)}
            />
          ) : subjects === null ? (
            <LoadingSkeleton className="h-24 w-full" label={copy.createTitle} />
          ) : subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {copy.needSubject}{" "}
              <Link href="/admin/settings" className="font-medium text-foreground underline-offset-4 hover:underline">
                {copy.openSubjects}
              </Link>
            </p>
          ) : (
            <form className="grid gap-3" onSubmit={(event) => void createPassage(event)}>
              {subjectError ? (
                <ErrorState
                  title={copy.subjectsError}
                  message={subjectError}
                  retryLabel={copy.retry}
                  onRetry={() => setReloadKey((current) => current + 1)}
                />
              ) : null}
              <div className="grid gap-1.5">
                <Label htmlFor="knowledge-course">{copy.course}</Label>
                <SelectControl
                  id="knowledge-course"
                  value={courseId}
                  aria-invalid={Boolean(fieldErrors.course)}
                  onChange={(event) => {
                    setCourseId(event.target.value);
                    setFieldErrors((current) => ({ ...current, course: undefined }));
                  }}
                >
                  <option value="">{copy.coursePlaceholder}</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code} — {subject.name}
                    </option>
                  ))}
                </SelectControl>
                {fieldErrors.course ? <p className="text-sm text-destructive">{fieldErrors.course}</p> : null}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="knowledge-title">{copy.titleLabel}</Label>
                <Input
                  id="knowledge-title"
                  value={title}
                  aria-invalid={Boolean(fieldErrors.title)}
                  aria-describedby="knowledge-title-hint"
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setFieldErrors((current) => ({ ...current, title: undefined }));
                  }}
                />
                <p id="knowledge-title-hint" className="text-xs text-muted-foreground">
                  {copy.titleHint}
                </p>
                {fieldErrors.title ? <p className="text-sm text-destructive">{fieldErrors.title}</p> : null}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="knowledge-content">{copy.contentLabel}</Label>
                <TextArea
                  id="knowledge-content"
                  value={content}
                  rows={6}
                  aria-invalid={Boolean(fieldErrors.content)}
                  aria-describedby="knowledge-content-hint"
                  onChange={(event) => {
                    setContent(event.target.value);
                    setFieldErrors((current) => ({ ...current, content: undefined }));
                  }}
                />
                <p id="knowledge-content-hint" className="text-xs text-muted-foreground">
                  {copy.contentHint}
                </p>
                {fieldErrors.content ? <p className="text-sm text-destructive">{fieldErrors.content}</p> : null}
              </div>
              <Button type="submit" className="w-fit" disabled={saving}>
                {saving ? copy.saving : copy.create}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {listError && passages === null ? (
        <ErrorState
          title={copy.loadError}
          message={listError}
          retryLabel={copy.retry}
          onRetry={() => setReloadKey((current) => current + 1)}
        />
      ) : passages === null ? (
        <LoadingSkeleton className="h-48 w-full" label={copy.loadError} />
      ) : (
        <Card className="min-w-0 bg-card">
          <CardHeader className="border-b">
            <CardTitle className="font-serif text-2xl">
              {t("admin.knowledge.count", { count: String(passages.length) })}
            </CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {listError ? (
              <div className="p-4">
                <ErrorState
                  title={copy.loadError}
                  message={listError}
                  retryLabel={copy.retry}
                  onRetry={() => setReloadKey((current) => current + 1)}
                />
              </div>
            ) : null}
            <div className="border-b px-4 py-4">
              <Label htmlFor="knowledge-search" className="sr-only">
                {copy.searchLabel}
              </Label>
              <Input
                id="knowledge-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchLabel}
                className="max-w-sm"
              />
            </div>
            {visible.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {passages.length === 0 ? copy.empty : copy.noResults}
              </p>
            ) : (
              <ul className="divide-y">
                {visible.map((passage) => (
                  <li key={passage.id} className="space-y-1 px-4 py-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                      <p className="font-medium">{passage.title}</p>
                      <p className="text-xs text-muted-foreground">{formatAdminDate(passage.createdAt, locale)}</p>
                    </div>
                    <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{passage.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
