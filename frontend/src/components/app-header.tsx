"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitch } from "@/components/language-switch";
import { readTokenClaims } from "@/lib/auth";
import { useLocale, useRoleLabel } from "@/lib/i18n/locale-provider";
import { homeForRole } from "@/lib/role-home";
import type { User } from "@/lib/types";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppHeader({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const { t } = useLocale();
  const roleLabel = useRoleLabel(user.role);
  const onAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const showAdminNav =
    user.role === "ADMIN" && readTokenClaims()?.role === "ADMIN";

  return (
    <header className="border-b bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href={homeForRole(user.role)} className="flex items-center gap-3">
            <BrandMark className="size-8 text-base" />
            <div className="leading-tight">
              <p className="font-serif text-lg">AIVES</p>
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {t("brand.workspace")}
              </p>
            </div>
          </Link>
          {showAdminNav ? (
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href={homeForRole(user.role)}
                className={
                  pathname === homeForRole(user.role)
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }
              >
                {t("common.home")}
              </Link>
              <Link
                href="/admin"
                className={
                  onAdmin
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }
              >
                {t("common.admin")}
              </Link>
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitch />
          <span className="hidden text-sm text-muted-foreground sm:block">
            {roleLabel}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-10 items-center gap-2 rounded-lg px-1.5 text-sm hover:bg-muted sm:px-2.5">
              <Avatar size="sm">
                <AvatarFallback>{initials(user.name)}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-40 truncate sm:inline">
                {user.name}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">
                    {user.email}
                  </p>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut}>
                <LogOutIcon />
                {t("common.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
