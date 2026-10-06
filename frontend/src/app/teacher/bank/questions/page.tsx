import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2Icon } from "lucide-react";
import { TeacherQuestionsListView } from "@/components/teacher/questions-list-view";

export const metadata: Metadata = { title: "Question list" };

function QuestionsFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function TeacherQuestionsListPage() {
  return (
    <Suspense fallback={<QuestionsFallback />}>
      <TeacherQuestionsListView />
    </Suspense>
  );
}
