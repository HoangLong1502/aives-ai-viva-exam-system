import { api } from "@/lib/api";

export type StudentSortKey = "name" | "code" | "email" | "createdAt";
export type SortDirection = "asc" | "desc";

export type StudentRecord = {
  id: string;
  name: string;
  email: string;
  studentCode: string;
  phone: string | null;
  active: boolean;
  createdAt: string;
};

export type StudentPage = {
  items: StudentRecord[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
};

export type StudentFormInput = {
  name: string;
  email: string;
  studentCode: string;
  phone: string;
  password: string;
};

export type StudentFieldCopy = {
  required: string;
  nameInvalid: string;
  emailInvalid: string;
  codeInvalid: string;
  phoneInvalid: string;
  passwordInvalid: string;
};

const CODE_PATTERN = /^[A-Za-z0-9]{3,50}$/;
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function fetchStudents(
  params: {
    page: number;
    size: number;
    sort: StudentSortKey;
    dir: SortDirection;
    q: string;
  },
  signal: AbortSignal,
) {
  const search = new URLSearchParams({
    page: String(params.page),
    size: String(params.size),
    sort: params.sort,
    dir: params.dir,
  });
  if (params.q) search.set("q", params.q);
  return api<unknown>(`/api/students?${search.toString()}`, {
    auth: true,
    signal,
    cache: "no-store",
  }).then(parseStudentPage);
}

export function createStudent(input: StudentFormInput) {
  return api<unknown>("/api/students", {
    method: "POST",
    auth: true,
    body: {
      name: input.name.trim(),
      email: input.email.trim(),
      studentCode: input.studentCode.trim(),
      password: input.password,
      phone: input.phone.trim() || null,
    },
  }).then(parseStudent);
}

export function updateStudent(
  id: string,
  input: Pick<StudentFormInput, "name" | "email" | "studentCode" | "phone"> & { active: boolean },
) {
  return api<unknown>(`/api/students/${id}`, {
    method: "PUT",
    auth: true,
    body: {
      name: input.name.trim(),
      email: input.email.trim(),
      studentCode: input.studentCode.trim(),
      phone: input.phone.trim() || null,
      active: input.active,
    },
  }).then(parseStudent);
}

export function deleteStudent(id: string) {
  return api<void>(`/api/students/${id}`, { method: "DELETE", auth: true });
}

export function studentFieldErrors(
  input: StudentFormInput,
  mode: "create" | "edit",
  copy: StudentFieldCopy,
) {
  const errors: Partial<Record<keyof StudentFormInput, string>> = {};
  const name = input.name.trim();
  if (!name) errors.name = copy.required;
  else if (name.length > 255) errors.name = copy.nameInvalid;

  const email = input.email.trim();
  if (!email) errors.email = copy.required;
  else if (email.length > 255 || !EMAIL_PATTERN.test(email)) errors.email = copy.emailInvalid;

  const code = input.studentCode.trim();
  if (!code) errors.studentCode = copy.required;
  else if (!CODE_PATTERN.test(code)) errors.studentCode = copy.codeInvalid;

  const phone = input.phone.trim();
  if (phone && !PHONE_PATTERN.test(phone)) errors.phone = copy.phoneInvalid;

  if (mode === "create") {
    if (!input.password) errors.password = copy.required;
    else if (input.password.length < 8 || input.password.length > 72) {
      errors.password = copy.passwordInvalid;
    }
  }

  return errors;
}

function parseStudentPage(value: unknown): StudentPage {
  if (!isRecord(value) || !Array.isArray(value.items)) throw new Error("invalid");
  if (
    typeof value.page !== "number" ||
    typeof value.size !== "number" ||
    typeof value.totalItems !== "number" ||
    typeof value.totalPages !== "number"
  ) {
    throw new Error("invalid");
  }
  return {
    items: value.items.map(parseStudent),
    page: value.page,
    size: value.size,
    totalItems: value.totalItems,
    totalPages: value.totalPages,
  };
}

function parseStudent(value: unknown): StudentRecord {
  if (!isRecord(value)) throw new Error("invalid");
  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.email !== "string" ||
    typeof value.studentCode !== "string" ||
    !(value.phone === null || typeof value.phone === "string") ||
    typeof value.active !== "boolean" ||
    typeof value.createdAt !== "string"
  ) {
    throw new Error("invalid");
  }
  return {
    id: value.id,
    name: value.name,
    email: value.email,
    studentCode: value.studentCode,
    phone: value.phone,
    active: value.active,
    createdAt: value.createdAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
