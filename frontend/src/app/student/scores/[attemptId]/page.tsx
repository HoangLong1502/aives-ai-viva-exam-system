import type { Metadata } from "next";
import { StudentAttemptReview } from "@/components/student-attempt-review";

export const metadata: Metadata = { title: "Exam review" };

type PageProps = {
  params: Promise<{ attemptId: string }>;
};

export default async function StudentAttemptReviewPage({ params }: PageProps) {
  const { attemptId } = await params;
  return <StudentAttemptReview attemptId={attemptId} />;
}
