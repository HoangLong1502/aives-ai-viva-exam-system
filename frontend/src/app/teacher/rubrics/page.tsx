import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2Icon } from "lucide-react";
import { TeacherRubricsView } from "@/components/teacher/rubrics-view";

export const metadata: Metadata = { title: "Rubrics" };

function RubricsFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function TeacherRubricsPage() {
  return (
    <Suspense fallback={<RubricsFallback />}>
      <TeacherRubricsView />
    </Suspense>
  );
}
