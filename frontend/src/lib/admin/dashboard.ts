import { api, ApiError } from "@/lib/api";

export type AdminStats = {
  students: number;
  teachers: number;
  administrators: number;
  multipleChoiceInProgress: number;
  oralInProgress: number;
  multipleChoiceScheduled: number;
  oralScheduled: number;
  multipleChoiceCompleted: number;
  oralCompleted: number;
};

export type AdminSubject = {
  id: string;
  code: string;
  name: string;
  teacherIds: string[];
};

/** Attempt row from the administration desk. `status` is the exam session status. */
export type AdminAttempt = {
  id: string;
  examId: string;
  examTitle: string;
  studentName: string;
  teacherName: string;
  score: number | null;
  status: string;
};

export type CountedExamStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED";

export type ExamStatusTone = "neutral" | "warning" | "success" | "info";

export type ExamStatusCount = {
  status: CountedExamStatus;
  multipleChoice: number;
  oral: number;
  total: number;
};

const STAT_FIELDS = [
  "students",
  "teachers",
  "administrators",
  "multipleChoiceInProgress",
  "oralInProgress",
  "multipleChoiceScheduled",
  "oralScheduled",
  "multipleChoiceCompleted",
  "oralCompleted",
] as const satisfies readonly (keyof AdminStats)[];

const STATUS_PRESENTATION: Record<
  string,
  { tone: ExamStatusTone; barClass: string }
> = {
  SCHEDULED: { tone: "info", barClass: "bg-primary" },
  IN_PROGRESS: { tone: "warning", barClass: "bg-amber-600" },
  COMPLETED: { tone: "success", barClass: "bg-emerald-600" },
  DRAFT: { tone: "neutral", barClass: "bg-muted-foreground" },
  PUBLISHED: { tone: "info", barClass: "bg-primary" },
};

export function fetchAdminStats(signal: AbortSignal) {
  return api<unknown>("/api/admin/stats", { auth: true, signal, cache: "no-store" });
}

export function fetchAdminSubjects(signal: AbortSignal) {
  return api<unknown>("/api/admin/subjects", { auth: true, signal, cache: "no-store" });
}

export function fetchAdminAttempts(signal: AbortSignal) {
  return api<unknown>("/api/admin/performance", { auth: true, signal, cache: "no-store" });
}

export function parseAdminStats(value: unknown): AdminStats {
  if (!isRecord(value)) throw new Error("invalid");
  const stats = {} as AdminStats;
  for (const field of STAT_FIELDS) {
    const numberValue = value[field];
    if (typeof numberValue !== "number" || !Number.isFinite(numberValue)) {
      throw new Error("invalid");
    }
    stats[field] = numberValue;
  }
  return stats;
}

export function parseAdminSubjects(value: unknown): AdminSubject[] {
  if (!Array.isArray(value)) throw new Error("invalid");
  return value.map((item) => {
    if (!isRecord(item)) throw new Error("invalid");
    if (
      typeof item.id !== "string" ||
      typeof item.code !== "string" ||
      typeof item.name !== "string" ||
      !Array.isArray(item.teacherIds) ||
      item.teacherIds.some((teacherId) => typeof teacherId !== "string")
    ) {
      throw new Error("invalid");
    }
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      teacherIds: item.teacherIds,
    };
  });
}

export function parseAdminAttempts(value: unknown): AdminAttempt[] {
  if (!Array.isArray(value)) throw new Error("invalid");
  return value.map((item) => {
    if (!isRecord(item)) throw new Error("invalid");
    if (
      typeof item.id !== "string" ||
      typeof item.examId !== "string" ||
      typeof item.examTitle !== "string" ||
      typeof item.studentName !== "string" ||
      typeof item.teacherName !== "string" ||
      typeof item.status !== "string" ||
      !(item.score === null || typeof item.score === "number")
    ) {
      throw new Error("invalid");
    }
    return {
      id: item.id,
      examId: item.examId,
      examTitle: item.examTitle,
      studentName: item.studentName,
      teacherName: item.teacherName,
      score: item.score,
      status: item.status,
    };
  });
}

export function examStatusCounts(stats: AdminStats): ExamStatusCount[] {
  return [
    row("SCHEDULED", stats.multipleChoiceScheduled, stats.oralScheduled),
    row("IN_PROGRESS", stats.multipleChoiceInProgress, stats.oralInProgress),
    row("COMPLETED", stats.multipleChoiceCompleted, stats.oralCompleted),
  ];
}

export function subjectsMissingTeachers(subjects: readonly AdminSubject[]) {
  return subjects
    .filter((subject) => subject.teacherIds.length === 0)
    .slice()
    .sort((left, right) => left.code.localeCompare(right.code));
}

export function examStatusPresentation(status: string) {
  return STATUS_PRESENTATION[status] ?? { tone: "neutral" as const, barClass: "bg-muted-foreground" };
}

export type DashboardError =
  | { kind: "forbidden" }
  | { kind: "generic" }
  | { kind: "unexpected" }
  | { kind: "message"; text: string };

export function dashboardErrorMessage(
  error: DashboardError,
  copy: { forbidden: string; generic: string; unexpected: string },
) {
  if (error.kind === "forbidden") return copy.forbidden;
  if (error.kind === "unexpected") return copy.unexpected;
  if (error.kind === "message") return error.text;
  return copy.generic;
}

export function dashboardErrorFrom(error: unknown): DashboardError {
  if (error instanceof ApiError) {
    if (error.status === 403) return { kind: "forbidden" };
    return { kind: "message", text: error.message };
  }
  return { kind: "generic" };
}

function row(status: CountedExamStatus, multipleChoice: number, oral: number): ExamStatusCount {
  return { status, multipleChoice, oral, total: multipleChoice + oral };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
