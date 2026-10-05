"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2Icon, LogOutIcon } from "lucide-react";
import { toast } from "sonner";
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
import { useLocale, useRoleLabel } from "@/lib/i18n/locale-provider";
import { homeForRole } from "@/lib/role-home";
import { useCurrentUser } from "@/lib/use-current-user";
import type { Role } from "@/lib/types";
import { cn } from "cn";

export function PortalShell({
  role,
  eyebrow,
  nav,
  children,
}: {
  role: Role;
  eyebrow: string;
  nav: { href: string; label: string; exact?: boolean }[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useCurrentUser();
  const { t } = useLocale();
  const roleLabel = useRoleLabel(user?.role ?? role);

  useEffect(() => {
    if (user && user.role !== role) {
      toast.error(t("errors.wrongRolePortal"));
      router.replace(homeForRole(user.role));
    }
  }, [user, role, router, t]);

  if (!user || user.role !== role) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b bg-card/80 px-4 backdrop-blur sm:px-6">
        <Link href={homeForRole(role)} className="flex items-center gap-3">
          <BrandMark className="size-8 text-base" />
          <div className="leading-tight">
            <p className="font-serif text-lg">AIVES</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {eyebrow}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitch />
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-10 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted">
            <Avatar size="sm">
              <AvatarFallback>
                {user.name.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">{user.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {roleLabel}
                </p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOutIcon />
              {t("common.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r bg-card/40 md:block">
          <nav className="flex flex-col gap-1 p-3">
            {nav.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8">
          <nav className="mb-6 flex gap-2 overflow-x-auto md:hidden">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg bg-muted px-3 py-2 text-sm"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {children}
        </div>
      </div>
    </div>
  );
}
