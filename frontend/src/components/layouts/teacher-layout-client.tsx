"use client";

import { useMemo, type ReactNode } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useLocale } from "@/lib/i18n/locale-provider";

export function TeacherLayoutClient({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const nav = useMemo(
    () => [
      { href: "/teacher", label: t("nav.teacher.bank"), exact: true },
      { href: "/teacher/tests", label: t("nav.teacher.tests") },
      { href: "/teacher/scores", label: t("nav.teacher.scores") },
    ],
    [t],
  );

  return (
    <PortalShell role="EXAMINER" eyebrow={t("roles.teacher")} nav={nav}>
      {children}
    </PortalShell>
  );
}
