"use client";

import { useMemo, type ReactNode } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useLocale } from "@/lib/i18n/locale-provider";

export function StudentLayoutClient({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const nav = useMemo(
    () => [
      { href: "/student", label: t("nav.student.tests"), exact: true },
      { href: "/student/scores", label: t("nav.student.scores") },
      { href: "/student/profile", label: t("nav.student.profile") },
      { href: "/student/history", label: t("nav.student.history") },
    ],
    [t],
  );

  return (
    <PortalShell role="STUDENT" eyebrow={t("roles.student")} nav={nav}>
      {children}
    </PortalShell>
  );
}
