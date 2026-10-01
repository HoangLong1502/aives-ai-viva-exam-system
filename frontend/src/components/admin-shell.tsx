"use client";

import {
  createContext,
  useContext,
  useEffect,
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
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
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
import { useCurrentUser } from "@/lib/use-current-user";
import { ROLE_LABEL, type User } from "@/lib/types";
import { cn } from "cn";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon, exact: true },
  { href: "/admin/people", label: "People", icon: UsersIcon, exact: false },
  { href: "/admin/performance", label: "Performance", icon: ClipboardListIcon, exact: false },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon, exact: false },
  { href: "/admin/knowledge", label: "Knowledge", icon: BookOpenIcon, exact: false },
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

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, signOut } = useCurrentUser();

  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      toast.error("Only administrators can open this dashboard.");
      router.replace("/");
    }
  }, [user, router]);

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
          <Link href="/admin" className="flex items-center gap-3">
            <BrandMark className="size-8 text-base" />
            <div className="leading-tight">
              <p className="font-serif text-lg">AIVES</p>
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Administration
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:block">
              {ROLE_LABEL[user.role]}
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
                <DropdownMenuItem onClick={signOut}>
                  <LogOutIcon />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-60 shrink-0 border-r bg-card/40 md:block">
            <AdminNav pathname={pathname} />
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b md:hidden">
              <AdminNav pathname={pathname} compact />
            </div>
            <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8">
              {children}
            </div>
          </div>
        </div>
      </div>
    </AdminSessionContext.Provider>
  );
}

function AdminNav({
  pathname,
  compact = false,
}: {
  pathname: string;
  compact?: boolean;
}) {
  return (
    <nav
      className={cn(
        "flex gap-1 p-3",
        compact ? "flex-row overflow-x-auto" : "flex-col",
      )}
    >
      {NAV.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
