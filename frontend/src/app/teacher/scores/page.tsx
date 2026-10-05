import type { Metadata } from "next";
import { TeacherScoresView } from "@/components/teacher-scores-view";

export const metadata: Metadata = { title: "Scores" };

export default function TeacherScoresPage() {
  return <TeacherScoresView />;
}
