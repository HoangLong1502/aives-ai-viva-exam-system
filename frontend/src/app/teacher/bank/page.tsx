import type { Metadata } from "next";
import { TeacherBank } from "@/components/teacher-bank";

export const metadata: Metadata = { title: "Question bank" };

export default function TeacherBankPage() {
  return <TeacherBank />;
}
