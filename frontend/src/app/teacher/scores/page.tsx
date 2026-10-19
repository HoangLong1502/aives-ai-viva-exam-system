import type { Metadata } from "next";
import { GradingCoursesView } from "@/components/teacher/grading-views";

export const metadata: Metadata = { title: "Scores" };

export default function TeacherScoresPage() {
  return <GradingCoursesView />;
}
