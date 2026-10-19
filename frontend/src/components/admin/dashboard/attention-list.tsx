import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { subjectsMissingTeachers, type AdminSubject } from "@/lib/admin/dashboard";
import type { Messages } from "@/lib/i18n/messages/en";
import { EmptyState } from "@/components/admin/ui/dashboard-ui";

type AttentionCopy = Messages["admin"]["dashboard"]["attention"];

export function AttentionList({
  subjects,
  copy,
  countLabel,
}: {
  subjects: AdminSubject[];
  copy: AttentionCopy;
  countLabel: (count: number) => string;
}) {
  if (subjects.length === 0) {
    return (
      <Card className="min-w-0">
        <CardContent>
          <EmptyState title={copy.emptySubjects} />
        </CardContent>
      </Card>
    );
  }

  const missing = subjectsMissingTeachers(subjects);
  if (missing.length === 0) {
    return (
      <Card className="min-w-0">
        <CardContent>
          <EmptyState title={copy.emptyAssigned} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0">
      <CardContent className="px-0">
        <p className="px-4 pb-3 text-sm text-muted-foreground">{countLabel(missing.length)}</p>
        <ul className="max-h-80 divide-y overflow-y-auto border-t">
          {missing.map((subject) => (
            <li key={subject.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{subject.code}</p>
                <p className="truncate text-sm text-muted-foreground">{subject.name}</p>
              </div>
              <Link
                href="/admin/settings"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {copy.assign}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
