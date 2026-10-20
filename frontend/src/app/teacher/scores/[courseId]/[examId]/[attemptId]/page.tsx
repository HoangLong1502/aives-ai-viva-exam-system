import type { Metadata } from "next";
import { GradingAttemptView } from "@/components/teacher/grading-views";

export const metadata: Metadata = { title: "Grade answers" };

type PageProps = {
  params: Promise<{ courseId: string; examId: string; attemptId: string }>;
};

export default async function TeacherAttemptGradingPage({ params }: PageProps) {
  const { courseId, examId, attemptId } = await params;
  return <GradingAttemptView courseId={courseId} examId={examId} attemptId={attemptId} />;
}
