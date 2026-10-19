"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  Loader2Icon,
  LogOutIcon,
  PanelLeftCloseIcon,
  PanelLeftIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
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
import { useCurrentUser } from "@/lib/use-current-user";
import type { User } from "@/lib/types";
import { cn } from "cn";

const NAV_ICONS = [
  { href: "/admin", key: "nav.admin.dashboard", icon: LayoutDashboardIcon, exact: true },
  { href: "/admin/people", key: "nav.admin.people", icon: UsersIcon, exact: false },
  { href: "/admin/performance", key: "nav.admin.performance", icon: ClipboardListIcon, exact: false },
  { href: "/admin/settings", key: "nav.admin.settings", icon: SettingsIcon, exact: false },
  { href: "/admin/knowledge", key: "nav.admin.knowledge", icon: BookOpenIcon, exact: false },
] as const;

type AdminSession = {
  user: User;
  setUser: (user: User) => void;
  signOut: () => void;
};

const AdminSessionContext = createContext<AdminSession | null>(null);

export function useAdminSession() {
  const session = useContext(AdminSessionContext);
  if (!session) {
    throw new Error("useAdminSession must be used inside the admin shell");
  }
  return session;
}

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, signOut } = useCurrentUser();
  const { t } = useLocale();
  const roleLabel = useRoleLabel("ADMIN");
  const [collapsed, setCollapsed] = useState(false);
  const nav = useMemo(
    () =>
      NAV_ICONS.map((item) => ({
        ...item,
        label: t(item.key),
      })),
    [t],
  );
  const current = nav.find((item) => isActive(pathname, item.href, item.exact));
  const pageTitle = current?.label ?? t("nav.admin.dashboard");

  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      toast.error(t("errors.adminOnly"));
      router.replace("/");
    }
  }, [user, router, t]);

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AdminSessionContext.Provider value={{ user, setUser, signOut }}>
      <div className="flex min-h-svh flex-col bg-background">
        <header className="flex h-16 items-center justify-between border-b bg-card/80 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin" className="flex shrink-0 items-center gap-3">
              <BrandMark className="size-8 text-base" />
              <div className="leading-tight">
                <p className="font-serif text-lg">AIVES</p>
                <p className="hidden text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:block">
                  {t("brand.adminEyebrow")}
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
              <DropdownMenuTrigger className="inline-flex h-10 max-w-48 items-center rounded-lg px-2.5 text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                <span className="truncate">{user.name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
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
          <aside
            className={cn(
              "hidden shrink-0 border-r bg-card/40 motion-safe:transition-[width] motion-safe:duration-200 md:flex md:flex-col",
              collapsed ? "w-[4.25rem]" : "w-60",
            )}
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
            <AdminNav pathname={pathname} items={nav} collapsed={collapsed} label={t("admin.shell.navLabel")} />
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b md:hidden">
              <AdminNav pathname={pathname} items={nav} compact label={t("admin.shell.navLabel")} />
            </div>
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
              <p className="mb-4 font-medium md:hidden">{pageTitle}</p>
              {children}
            </main>
          </div>
        </div>
      </div>
    </AdminSessionContext.Provider>
  );
}

function AdminNav({
  pathname,
  items,
  collapsed = false,
  compact = false,
  label,
}: {
  pathname: string;
  items: { href: string; label: string; icon: typeof LayoutDashboardIcon; exact: boolean }[];
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
        const active = isActive(pathname, item.href, item.exact);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center rounded-lg text-sm whitespace-nowrap focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              collapsed ? "justify-center px-2 py-2.5" : "gap-2 px-3 py-2",
              active
                ? "bg-primary/10 font-medium text-foreground shadow-[inset_3px_0_0_0_var(--primary)]"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              compact && active && "shadow-none",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
          </Link>
        );
      })}
    </nav>
  );
}
