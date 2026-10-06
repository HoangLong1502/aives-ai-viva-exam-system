"use client";

import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import { FieldLabel } from "@/components/ui/field";
import { rubricEditHref } from "@/lib/teacher/rubrics";
import { cn } from "cn";

export function RubricFieldLabel({
  htmlFor,
  subjectId,
  rubricId,
  label,
  hint,
  returnTo,
}: {
  htmlFor: string;
  subjectId: string;
  rubricId: string;
  label: string;
  hint: string;
  returnTo?: string;
}) {
  const href = rubricEditHref(subjectId, rubricId, returnTo);

  return (
    <FieldLabel htmlFor={htmlFor} className="flex w-full items-center justify-between gap-2">
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {label}
        <ExternalLinkIcon className="size-3 opacity-70" aria-hidden />
      </Link>
      <span className="text-xs font-normal text-muted-foreground">{hint}</span>
    </FieldLabel>
  );
}
