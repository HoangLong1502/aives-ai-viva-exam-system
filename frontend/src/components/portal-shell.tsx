"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Loader2Icon,
  LogOutIcon,
  PanelLeftCloseIcon,
  PanelLeftIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import {
  shellAccountTriggerClass,
  shellAsideClass,
  shellBrandEyebrowClass,
  shellHeaderClass,
  shellMainClass,
  shellNavItemClass,
} from "@/components/shell-styles";
import { cn } from "cn";

export function PortalShell({
  role,
  eyebrow,
  nav,
  children,
}: {
  role: Role;
  eyebrow: string;
  nav: { href: string; label: string; exact?: boolean; icon?: LucideIcon }[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useCurrentUser();
  const { t } = useLocale();
  const roleLabel = useRoleLabel(user?.role ?? role);
  // Đường dẫn đến trang Profile tương ứng với Role (VD: /student/profile)
  const profileHref = `/${(user?.role ?? role).toLowerCase()}/profile`;
  const [collapsed, setCollapsed] = useState(false);
  const isActive = (item: { href: string; exact?: boolean }) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const profileLabel = t("nav.student.profile") || t("student_profile.edit") || "My Profile";
  const pageTitle =
    pathname === profileHref ? profileLabel : (nav.find(isActive) ?? nav[0])?.label ?? "";


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
      <header className={shellHeaderClass}>
        <div className="flex min-w-0 items-center gap-3">
          <Link href={homeForRole(role)} className="flex shrink-0 items-center gap-3">
            <BrandMark className="size-8 text-base" />
            <div className="leading-tight">
              <p className="font-serif text-lg">AIVES</p>
              <p className={shellBrandEyebrowClass}>
                {eyebrow}
              </p>
            </div>
          </Link>
          <span className="hidden h-6 w-px bg-border md:block" aria-hidden />
          <p className="hidden truncate font-medium md:block">{pageTitle}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitch />
          <span className="hidden text-sm text-muted-foreground lg:block">{roleLabel}</span>
          <DropdownMenu>
            <DropdownMenuTrigger className={shellAccountTriggerClass}>
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
                  <p className="text-xs font-normal text-muted-foreground">
                    {user.email}
                  </p>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <Link href={profileHref} className="cursor-pointer">
                    <UserIcon className="mr-2 size-4" />
                    {profileLabel}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                <LogOutIcon className="mr-2 size-4" />
                {t("common.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside
          className={shellAsideClass(collapsed)}
        >
          <div className={cn("flex p-2", collapsed ? "justify-center" : "justify-end")}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setCollapsed((value) => !value)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? t("admin.shell.expandNav") : t("admin.shell.collapseNav")}
            >
              {collapsed ? <PanelLeftIcon /> : <PanelLeftCloseIcon />}
            </Button>
          </div>
          <PortalNav items={nav} isActive={isActive} collapsed={collapsed} label={eyebrow} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b md:hidden">
            <PortalNav items={nav} isActive={isActive} compact label={eyebrow} />
          </div>
          <main className={shellMainClass}>
            <p className="mb-4 font-medium md:hidden">{pageTitle}</p>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function PortalNav({
  items,
  isActive,
  collapsed = false,
  compact = false,
  label,
}: {
  items: { href: string; label: string; exact?: boolean; icon?: LucideIcon }[];
  isActive: (item: { href: string; exact?: boolean }) => boolean;
  collapsed?: boolean;
  compact?: boolean;
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn("flex gap-1 p-3", compact ? "flex-row overflow-x-auto pt-3" : "flex-col pt-0")}
    >
      {items.map((item) => {
        const active = isActive(item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={shellNavItemClass({ active, collapsed, compact })}
          >
            {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
            {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
          </Link>
        );
      })}
    </nav>
  );
}
