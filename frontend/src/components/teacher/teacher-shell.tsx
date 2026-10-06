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
  ClipboardCheckIcon,
  LayoutDashboardIcon,
  Loader2Icon,
  LogOutIcon,
  PanelLeftCloseIcon,
  PanelLeftIcon,
  PlayCircleIcon,
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
import { cn } from "cn";

const NAV = [
  { href: "/teacher", key: "nav.teacher.overview", icon: LayoutDashboardIcon, exact: true },
  { href: "/teacher/tests", key: "nav.teacher.exams", icon: PlayCircleIcon, exact: false },
  { href: "/teacher/bank", key: "nav.teacher.bank", icon: BookOpenIcon, exact: false },
  { href: "/teacher/scores", key: "nav.teacher.scores", icon: ClipboardCheckIcon, exact: false },
] as const;

const PAGE_TITLE_KEYS: Record<string, "overview" | "exams" | "bank" | "rubrics" | "scores"> = {
  "/teacher": "overview",
  "/teacher/tests": "exams",
  "/teacher/bank": "bank",
  "/teacher/scores": "scores",
};

type TeacherShellContextValue = {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
};

const TeacherShellContext = createContext<TeacherShellContextValue | null>(null);

export function useTeacherShell() {
  const ctx = useContext(TeacherShellContext);
  if (!ctx) {
    throw new Error("useTeacherShell must be used inside TeacherShell");
  }
  return ctx;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function resolvePageTitleKey(pathname: string) {
  if (pathname.startsWith("/teacher/rubrics")) return "rubrics";
  if (pathname.startsWith("/teacher/bank/questions")) return "bank";
  if (PAGE_TITLE_KEYS[pathname]) return PAGE_TITLE_KEYS[pathname];
  for (const href of Object.keys(PAGE_TITLE_KEYS)) {
    if (href !== "/teacher" && pathname.startsWith(`${href}/`)) {
      return PAGE_TITLE_KEYS[href];
    }
  }
  return "overview";
}

export function TeacherShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useCurrentUser();
  const { t } = useLocale();
  const roleLabel = useRoleLabel("EXAMINER");
  const [collapsed, setCollapsed] = useState(false);

  const nav = useMemo(
    () =>
      NAV.map((item) => ({
        ...item,
        label: t(item.key),
      })),
    [t],
  );

  const pageTitleKey = resolvePageTitleKey(pathname);
  const pageTitle = t(`teacher.pages.${pageTitleKey}`);

  useEffect(() => {
    if (user && user.role !== "EXAMINER") {
      toast.error(t("errors.wrongRolePortal"));
      router.replace(homeForRole(user.role));
    }
  }, [user, router, t]);

  if (!user || user.role !== "EXAMINER") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TeacherShellContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="flex min-h-svh flex-col bg-background">
        <header className="flex h-16 items-center justify-between border-b bg-card/80 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/teacher" className="flex shrink-0 items-center gap-3">
              <BrandMark className="size-8 text-base" />
              <div className="leading-tight">
                <p className="font-serif text-lg">AIVES</p>
                <p className="hidden text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:block">
                  {t("roles.teacher")}
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
              <DropdownMenuTrigger className="inline-flex h-10 items-center gap-2 rounded-lg px-1.5 text-sm hover:bg-muted sm:px-2.5">
                <Avatar size="sm">
                  <AvatarFallback>{initials(user.name)}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-36 truncate sm:inline">{user.name}</span>
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
              "hidden shrink-0 border-r bg-card/40 transition-[width] duration-200 md:flex md:flex-col",
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
                aria-label={collapsed ? t("teacher.shell.expandNav") : t("teacher.shell.collapseNav")}
              >
                {collapsed ? <PanelLeftIcon className="size-4" /> : <PanelLeftCloseIcon className="size-4" />}
              </Button>
            </div>
            <TeacherNav pathname={pathname} items={nav} collapsed={collapsed} />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b md:hidden">
              <TeacherNav pathname={pathname} items={nav} compact />
            </div>
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
              <p className="mb-4 font-medium md:hidden">{pageTitle}</p>
              {children}
            </main>
          </div>
        </div>
      </div>
    </TeacherShellContext.Provider>
  );
}

function TeacherNav({
  pathname,
  items,
  collapsed = false,
  compact = false,
}: {
  pathname: string;
  items: { href: string; label: string; icon: typeof LayoutDashboardIcon; exact: boolean }[];
  collapsed?: boolean;
  compact?: boolean;
}) {
  return (
    <nav
      className={cn(
        "flex gap-1 p-3 pt-0",
        compact ? "flex-row overflow-x-auto" : "flex-col",
      )}
      aria-label="Giảng viên"
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
              "flex items-center rounded-lg text-sm whitespace-nowrap",
              collapsed ? "justify-center px-2 py-2.5" : "gap-2 px-3 py-2",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {!collapsed ? <span>{item.label}</span> : <span className="sr-only">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
