"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/teacher/confirm-dialog";
import { StatusBadge } from "@/components/teacher/status-badge";
import { ErrorState, LoadingSkeleton } from "@/components/admin/ui/dashboard-ui";
import { Pager, SelectControl } from "@/components/admin/ui/controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import {
  createStudent,
  deleteStudent,
  fetchStudents,
  studentFieldErrors,
  updateStudent,
  type SortDirection,
  type StudentFormInput,
  type StudentPage,
  type StudentRecord,
  type StudentSortKey,
} from "@/lib/admin/students";
import { formatAdminDate } from "@/lib/admin/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { cn } from "cn";

const PAGE_SIZES = [5, 10, 20, 50] as const;

const EMPTY_FORM: StudentFormInput = {
  name: "",
  email: "",
  studentCode: "",
  phone: "",
  password: "",
};

type Editor =
  | { mode: "create"; form: StudentFormInput; baseline: StudentFormInput }
  | { mode: "edit"; id: string; active: boolean; form: StudentFormInput; baseline: StudentFormInput };

type PendingAction =
  | { kind: "delete"; student: StudentRecord }
  | { kind: "active"; student: StudentRecord };

export function StudentDirectory() {
  const { locale, messages, t } = useLocale();
  const copy = messages.admin.students;
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState<(typeof PAGE_SIZES)[number]>(5);
  const [sort, setSort] = useState<StudentSortKey>("name");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [data, setData] = useState<StudentPage | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const requestKey = `${debouncedQuery}|${page}|${size}|${sort}|${direction}|${reloadKey}`;

  useEffect(() => {
    const controller = new AbortController();
    fetchStudents(
      { page, size, sort, dir: direction, q: debouncedQuery },
      controller.signal,
    )
      .then((next) => {
        if (controller.signal.aborted) return;
        if (next.totalPages > 0 && page > next.totalPages - 1) {
          setPage(next.totalPages - 1);
          return;
        }
        setData(next);
        setLoadedKey(requestKey);
        setError(null);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError(messageFrom(reason, copy.loadError, copy.forbidden));
      });
    return () => controller.abort();
  }, [page, size, sort, direction, debouncedQuery, reloadKey, requestKey, copy.loadError, copy.forbidden]);

  function changeSort(next: StudentSortKey) {
    setPage(0);
    if (sort === next) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSort(next);
    setDirection("asc");
  }

  function openCreate() {
    setEditor({ mode: "create", form: EMPTY_FORM, baseline: EMPTY_FORM });
  }

  function openEdit(student: StudentRecord) {
    const form: StudentFormInput = {
      name: student.name,
      email: student.email,
      studentCode: student.studentCode,
      phone: student.phone ?? "",
      password: "",
    };
    setEditor({ mode: "edit", id: student.id, active: student.active, form, baseline: form });
  }

  async function runPending() {
    if (!pending) return;
    setConfirming(true);
    try {
      if (pending.kind === "delete") {
        await deleteStudent(pending.student.id);
        toast.success(copy.deleted);
        if (data && data.items.length === 1 && page > 0) setPage(page - 1);
      } else {
        await updateStudent(pending.student.id, {
          name: pending.student.name,
          email: pending.student.email,
          studentCode: pending.student.studentCode,
          phone: pending.student.phone ?? "",
          active: !pending.student.active,
        });
        toast.success(copy.updated);
      }
      setPending(null);
      setReloadKey((current) => current + 1);
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : copy.saveError);
    } finally {
      setConfirming(false);
    }
  }

  const stale = data !== null && loadedKey !== requestKey;

  return (
    <Card className="min-w-0 bg-card">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="font-serif text-2xl">{copy.title}</CardTitle>
          <Button type="button" onClick={openCreate}>
            {copy.add}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="student-search">{copy.searchLabel}</Label>
            <Input
              id="student-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder={copy.searchPlaceholder}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="student-page-size">{copy.pageSize}</Label>
            <SelectControl
              id="student-page-size"
              value={size}
              onChange={(event) => {
                setSize(Number(event.target.value) as (typeof PAGE_SIZES)[number]);
                setPage(0);
              }}
            >
              {PAGE_SIZES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </SelectControl>
          </div>
        </div>

        {error && data === null ? (
          <ErrorState
            title={copy.loadError}
            message={error}
            retryLabel={copy.retry}
            onRetry={() => {
              setError(null);
              setReloadKey((current) => current + 1);
            }}
          />
        ) : data === null ? (
          <LoadingSkeleton className="h-48 w-full" label={copy.loading} />
        ) : (
          <>
            {error ? (
              <ErrorState
                title={copy.loadError}
                message={error}
                retryLabel={copy.retry}
                onRetry={() => {
                  setError(null);
                  setReloadKey((current) => current + 1);
                }}
              />
            ) : null}
            <div className="flex flex-wrap gap-2">
              <SortHeader label={copy.sortName} column="name" sort={sort} direction={direction} onSort={changeSort} />
              <SortHeader label={copy.sortCode} column="code" sort={sort} direction={direction} onSort={changeSort} />
              <SortHeader label={copy.sortEmail} column="email" sort={sort} direction={direction} onSort={changeSort} />
              <SortHeader
                label={copy.sortCreated}
                column="createdAt"
                sort={sort}
                direction={direction}
                onSort={changeSort}
              />
            </div>
            {data.items.length === 0 ? (
              <p className="px-2 py-10 text-center text-sm text-muted-foreground">
                {debouncedQuery ? copy.noResults : copy.empty}
              </p>
            ) : (
              <ul className="divide-y rounded-xl border" aria-busy={stale}>
                {data.items.map((student) => (
                  <li
                    key={student.id}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{student.name}</p>
                        <StatusBadge
                          label={student.active ? copy.active : copy.inactive}
                          variant={student.active ? "success" : "neutral"}
                        />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {student.studentCode} · {student.email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {student.phone ?? "—"} · {formatAdminDate(student.createdAt, locale)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(student)}>
                        {copy.edit}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setPending({ kind: "active", student })}
                      >
                        {student.active ? copy.deactivate : copy.activate}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setPending({ kind: "delete", student })}
                      >
                        {copy.delete}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Pager
              summary={stale ? copy.loading : t("admin.students.total", { count: String(data.totalItems) })}
              page={data.totalPages === 0 ? 0 : data.page + 1}
              pages={data.totalPages}
              pageLabel={t("admin.students.page", {
                page: String(data.totalPages === 0 ? 0 : data.page + 1),
                pages: String(data.totalPages),
              })}
              previousLabel={copy.previous}
              nextLabel={copy.next}
              busy={stale}
              onPrevious={() => setPage(data.page - 1)}
              onNext={() => setPage(data.page + 1)}
            />
          </>
        )}
      </CardContent>

      <StudentFormDialog
        editor={editor}
        onClose={() => setEditor(null)}
        onSaved={() => {
          setEditor(null);
          setReloadKey((current) => current + 1);
        }}
      />

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === "delete"
            ? copy.confirmDeleteTitle
            : pending?.student.active
              ? copy.confirmDeactivateTitle
              : copy.confirmActivateTitle
        }
        description={
          pending
            ? t(
                pending.kind === "delete"
                  ? "admin.students.confirmDelete"
                  : pending.student.active
                    ? "admin.students.confirmDeactivate"
                    : "admin.students.confirmActivate",
                { name: pending.student.name },
              )
            : undefined
        }
        confirmLabel={
          pending?.kind === "delete"
            ? copy.delete
            : pending?.student.active
              ? copy.deactivate
              : copy.activate
        }
        cancelLabel={copy.cancel}
        destructive={pending?.kind === "delete" || pending?.student.active === true}
        confirming={confirming}
        onConfirm={() => void runPending()}
        onCancel={() => {
          if (!confirming) setPending(null);
        }}
      />
    </Card>
  );
}

function SortHeader({
  label,
  column,
  sort,
  direction,
  onSort,
}: {
  label: string;
  column: StudentSortKey;
  sort: StudentSortKey;
  direction: SortDirection;
  onSort: (column: StudentSortKey) => void;
}) {
  const active = sort === column;
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center rounded-lg border px-2.5 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "border-border bg-background font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      onClick={() => onSort(column)}
    >
      {label}
      {active ? (direction === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );
}

function StudentFormDialog({
  editor,
  onClose,
  onSaved,
}: {
  editor: Editor | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  if (!editor) return null;
  return (
    <StudentFormBody
      key={editor.mode === "edit" ? editor.id : "create"}
      editor={editor}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function StudentFormBody({
  editor,
  onClose,
  onSaved,
}: {
  editor: Editor;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { messages } = useLocale();
  const copy = messages.admin.students;
  const [form, setForm] = useState(editor.form);
  const [errors, setErrors] = useState<Partial<Record<keyof StudentFormInput, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [active, setActive] = useState(editor.mode === "edit" ? editor.active : true);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function updateField(field: keyof StudentFormInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function requestClose() {
    if (submitting) return;
    const dirty =
      form.name !== editor.baseline.name ||
      form.email !== editor.baseline.email ||
      form.studentCode !== editor.baseline.studentCode ||
      form.phone !== editor.baseline.phone ||
      form.password !== editor.baseline.password ||
      (editor.mode === "edit" && active !== editor.active);
    if (dirty) {
      setDiscarding(true);
      return;
    }
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = studentFieldErrors(form, editor.mode, copy);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setSubmitting(true);
    try {
      if (editor.mode === "create") {
        await createStudent(form);
        toast.success(copy.created);
      } else {
        await updateStudent(editor.id, { ...form, active });
        toast.success(copy.updated);
      }
      onSaved();
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : copy.saveError);
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) requestClose();
      }}
      className="fixed top-1/2 left-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 text-card-foreground shadow-lg outline-none backdrop:bg-black/40"
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className="font-serif text-xl">
        {editor.mode === "edit" ? copy.editTitle : copy.createTitle}
      </h2>
      {discarding ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">{copy.discardTitle}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDiscarding(false)}>
              {copy.keepEditing}
            </Button>
            <Button type="button" variant="destructive" onClick={onClose}>
              {copy.discard}
            </Button>
          </div>
        </div>
      ) : (
        <form className="mt-4 grid gap-3" noValidate onSubmit={(event) => void submit(event)}>
          <FormField
            id="student-name"
            label={copy.name}
            value={form.name}
            error={errors.name}
            onChange={(value) => updateField("name", value)}
          />
          <FormField
            id="student-email"
            label={copy.email}
            type="email"
            value={form.email}
            error={errors.email}
            onChange={(value) => updateField("email", value)}
          />
          <FormField
            id="student-code"
            label={copy.studentCode}
            value={form.studentCode}
            hint={copy.codeHint}
            error={errors.studentCode}
            onChange={(value) => updateField("studentCode", value)}
          />
          <FormField
            id="student-phone"
            label={copy.phone}
            value={form.phone}
            hint={copy.phoneHint}
            error={errors.phone}
            onChange={(value) => updateField("phone", value)}
          />
          {editor.mode === "create" ? (
            <FormField
              id="student-password"
              label={copy.password}
              type="password"
              value={form.password}
              hint={copy.passwordHint}
              error={errors.password}
              autoComplete="new-password"
              onChange={(value) => updateField("password", value)}
            />
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />
              {copy.active}
            </label>
          )}
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={requestClose} disabled={submitting}>
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? copy.saving : copy.save}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}

function FormField({
  id,
  label,
  value,
  hint,
  error,
  type = "text",
  autoComplete,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  hint?: string;
  error?: string;
  type?: string;
  autoComplete?: string;
  onChange: (value: string) => void;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function messageFrom(error: unknown, fallback: string, forbidden: string) {
  if (error instanceof ApiError) {
    if (error.status === 403) return forbidden;
    return error.message;
  }
  return fallback;
}
