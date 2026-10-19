"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AssignRoles } from "@/components/admin/people/assign-roles";
import { useAdminSession } from "@/components/admin/shell/admin-shell";
import { StudentDirectory } from "@/components/admin/students/student-directory";
import { ErrorState, LoadingSkeleton, PageHeader } from "@/components/admin/ui/dashboard-ui";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { User } from "@/lib/types";
import { cn } from "cn";

export function AdminPeople() {
  const router = useRouter();
  const { user, setUser } = useAdminSession();
  const { messages } = useLocale();
  const copy = messages.admin.people;
  const [people, setPeople] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<"roles" | "students">("roles");

  const load = useCallback(() => {
    const controller = new AbortController();
    api<User[]>("/api/users", { auth: true, signal: controller.signal, cache: "no-store" })
      .then((result) => {
        setPeople(result);
        setError(null);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 401) {
          router.replace("/");
          return;
        }
        setError(
          reason instanceof ApiError && reason.status === 403
            ? copy.forbidden
            : reason instanceof ApiError
              ? reason.message
              : copy.loadError,
        );
      });
    return () => controller.abort();
  }, [router, copy.forbidden, copy.loadError]);

  useEffect(() => {
    return load();
  }, [load, reloadKey]);

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} />

      <div
        role="tablist"
        aria-label={copy.tabsLabel}
        className="flex w-fit gap-1 rounded-lg bg-muted p-1"
        onKeyDown={(event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
          const current = tabs.findIndex((tabButton) => tabButton === document.activeElement);
          if (current < 0) return;
          const nextIndex =
            event.key === "ArrowRight"
              ? (current + 1) % tabs.length
              : (current - 1 + tabs.length) % tabs.length;
          tabs[nextIndex]?.focus();
          tabs[nextIndex]?.click();
        }}
      >
        <TabButton
          selected={tab === "roles"}
          controls="account-roles"
          onSelect={() => setTab("roles")}
        >
          {copy.rolesTab}
        </TabButton>
        <TabButton
          selected={tab === "students"}
          controls="account-students"
          onSelect={() => setTab("students")}
        >
          {copy.studentsTab}
        </TabButton>
      </div>

      <div id="account-roles" role="tabpanel" hidden={tab !== "roles"}>
        {error && people === null ? (
          <ErrorState
            title={copy.loadError}
            message={error}
            retryLabel={copy.retry}
            onRetry={() => setReloadKey((current) => current + 1)}
          />
        ) : people === null ? (
          <LoadingSkeleton className="h-48 w-full" label={copy.loadError} />
        ) : (
          <>
            {error ? (
              <div className="mb-4">
                <ErrorState
                  title={copy.loadError}
                  message={error}
                  retryLabel={copy.retry}
                  onRetry={() => setReloadKey((current) => current + 1)}
                />
              </div>
            ) : null}
            <AssignRoles
              currentUserId={user.id}
              users={people}
              onUsers={(update) => setPeople((current) => (current ? update(current) : current))}
              onAssigned={(updated) => {
                if (updated.id === user.id) setUser(updated);
              }}
            />
          </>
        )}
      </div>

      <div id="account-students" role="tabpanel" hidden={tab !== "students"}>
        {tab === "students" ? <StudentDirectory /> : null}
      </div>
    </div>
  );
}

function TabButton({
  selected,
  controls,
  onSelect,
  children,
}: {
  selected: boolean;
  controls: string;
  onSelect: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={controls}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
