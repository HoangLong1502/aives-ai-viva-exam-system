import type { Metadata } from "next";
import { GradingExamsView } from "@/components/teacher/grading-views";

export const metadata: Metadata = { title: "Course exams" };

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function TeacherCourseGradingPage({ params }: PageProps) {
  const { courseId } = await params;
  return <GradingExamsView courseId={courseId} />;
}
