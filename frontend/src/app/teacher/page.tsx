import type { Metadata } from "next";
import { TeacherOverviewView } from "@/components/teacher/overview-view";

export const metadata: Metadata = { title: "Overview" };

export default function TeacherPage() {
  return <TeacherOverviewView />;
}
