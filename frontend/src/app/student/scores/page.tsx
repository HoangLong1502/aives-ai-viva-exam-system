import type { Metadata } from "next";
import { StudentScoresView } from "@/components/student-scores-view";

export const metadata: Metadata = { title: "My scores" };

export default function StudentScoresPage() {
  return <StudentScoresView />;
}
