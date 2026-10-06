"use client";

import type { ReactNode } from "react";
import { TeacherShell } from "@/components/teacher/teacher-shell";

export function TeacherLayoutClient({ children }: { children: ReactNode }) {
  return <TeacherShell>{children}</TeacherShell>;
}
