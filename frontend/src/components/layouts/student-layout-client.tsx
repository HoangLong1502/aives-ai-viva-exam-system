"use client";

import { useMemo, type ReactNode } from "react";
import { ClipboardListIcon, FileTextIcon } from "lucide-react";
import { PortalShell } from "@/components/portal-shell";
import { useLocale } from "@/lib/i18n/locale-provider";

export function StudentLayoutClient({ children }: { children: ReactNode }) {
  const { t } = useLocale();

  // 1. Danh sách menu ở Sidebar bên trái (Đã bỏ My Profile)
  const nav = useMemo(
    () => [
      { href: "/student", label: t("nav.student.tests"), exact: true, icon: ClipboardListIcon },
      { href: "/student/scores", label: t("nav.student.scores"), icon: FileTextIcon },
    ],
    [t],
  );

  // Link "My Profile" ở dropdown góc phải do PortalShell tự render.
  return (
    <PortalShell role="STUDENT" eyebrow={t("roles.student")} nav={nav}>
      {children}
    </PortalShell>
  );
}