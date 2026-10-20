import { api } from "@/lib/api";

export const ADMIN_EXAM_STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export type AdminExamStatus = (typeof ADMIN_EXAM_STATUSES)[number];

/** One exam session as the administration desk sees it. Dates are ISO-8601 instants. */
export type AdminExam = {
  id: string;
  title: string;
  format: "ORAL" | "MULTIPLE_CHOICE" | string;
  status: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  questionCount: number;
  attemptCount: number;
  createdAt: string | null;
};

export type AdminExamFilters = { status?: string; subjectId?: string };

export function fetchAdminExams(filters: AdminExamFilters, signal?: AbortSignal) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.subjectId) params.set("subjectId", filters.subjectId);
  const query = params.toString();
  return api<AdminExam[]>(`/api/admin/exams${query ? `?${query}` : ""}`, {
    auth: true,
    signal,
    cache: "no-store",
  });
}

export function rescheduleExam(id: string, scheduledAt: string | null, durationMinutes: number | null) {
  return api<AdminExam>(`/api/admin/exams/${id}/schedule`, {
    method: "PATCH",
    auth: true,
    body: { scheduledAt, durationMinutes },
  });
}

export function setAdminExamStatus(id: string, status: AdminExamStatus) {
  return api<AdminExam>(`/api/admin/exams/${id}/status`, {
    method: "PATCH",
    auth: true,
    body: { status },
  });
}

/** ISO instant → value for an `<input type="datetime-local">` in the viewer's time zone. */
export function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `<input type="datetime-local">` value → ISO instant, or null when empty. */
export function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}
