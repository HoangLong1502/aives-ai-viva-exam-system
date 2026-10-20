import type { Metadata } from "next";
import { GradingParticipantsView } from "@/components/teacher/grading-views";

export const metadata: Metadata = { title: "Participants" };

type PageProps = {
  params: Promise<{ courseId: string; examId: string }>;
};

export default async function TeacherExamGradingPage({ params }: PageProps) {
  const { courseId, examId } = await params;
  return <GradingParticipantsView courseId={courseId} examId={examId} />;
}
