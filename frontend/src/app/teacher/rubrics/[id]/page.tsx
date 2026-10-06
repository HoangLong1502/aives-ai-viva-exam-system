import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2Icon } from "lucide-react";
import { TeacherRubricDetailView } from "@/components/teacher/rubric-detail-view";

export const metadata: Metadata = { title: "Edit rubric" };

function RubricDetailFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TeacherRubricDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<RubricDetailFallback />}>
      <TeacherRubricDetailView rubricId={id} />
    </Suspense>
  );
}
