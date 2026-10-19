"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/teacher/confirm-dialog";
import { Pager, SelectControl } from "@/components/admin/ui/controls";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import { ROLES, type Role, type User } from "@/lib/types";

const PAGE_SIZE = 5;

type SortKey = "name-asc" | "name-desc" | "email-asc" | "email-desc";

export function AssignRoles({
  currentUserId,
  users,
  onUsers,
  onAssigned,
}: {
  currentUserId: string;
  users: User[];
  onUsers: (update: (current: User[]) => User[]) => void;
  onAssigned?: (user: User) => void;
}) {
  const { t, messages } = useLocale();
  const copy = messages.admin.people;
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState<{ user: User; role: Role } | null>(null);

  const adminCount = users.filter((user) => user.role === "ADMIN").length;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = users.filter((user) => {
      if (roleFilter !== "ALL" && user.role !== roleFilter) return false;
      if (!needle) return true;
      return `${user.name} ${user.email}`.toLowerCase().includes(needle);
    });
    const [field, direction] = sort.split("-") as ["name" | "email", "asc" | "desc"];
    return filtered.sort((left, right) => {
      const result = left[field].localeCompare(right[field], undefined, { sensitivity: "base" });
      return direction === "asc" ? result : -result;
    });
  }, [users, query, roleFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const rows = visible.slice(start, start + PAGE_SIZE);
  const lastAdminBlocked =
    pending !== null &&
    pending.user.role === "ADMIN" &&
    pending.role !== "ADMIN" &&
    adminCount <= 1;

  function roleLabel(role: Role) {
    if (role === "STUDENT") return t("roles.student");
    if (role === "EXAMINER") return t("roles.teacher");
    return t("roles.admin");
  }

  async function assignRole() {
    if (!pending || lastAdminBlocked) return;
    const { user: target, role } = pending;
    let previous: User[] = users;
    onUsers((current) => {
      previous = current;
      return current.map((person) => (person.id === target.id ? { ...person, role } : person));
    });
    setSavingId(target.id);

    try {
      const updated = await api<User>(`/api/users/${target.id}/role`, {
        method: "PATCH",
        auth: true,
        body: { role },
      });
      onUsers((current) => current.map((person) => (person.id === target.id ? updated : person)));
      toast.success(
        t("admin.people.roleUpdated", { name: updated.name, role: roleLabel(updated.role) }),
      );
      onAssigned?.(updated);
      setPending(null);
    } catch (error) {
      onUsers(() => previous);
      toast.error(error instanceof ApiError ? error.message : copy.assignError);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Card className="min-w-0 bg-card">
      <CardHeader className="border-b">
        <CardTitle className="font-serif text-2xl">{copy.listTitle}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <div className="grid gap-1.5 sm:col-span-1">
            <Label htmlFor="account-search">{copy.searchLabel}</Label>
            <Input
              id="account-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder={copy.searchPlaceholder}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="account-role">{copy.roleFilter}</Label>
            <SelectControl
              id="account-role"
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value as Role | "ALL");
                setPage(0);
              }}
            >
              <option value="ALL">{copy.allRoles}</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </SelectControl>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="account-sort">{copy.sortLabel}</Label>
            <SelectControl
              id="account-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
            >
              <option value="name-asc">{copy.sortNameAsc}</option>
              <option value="name-desc">{copy.sortNameDesc}</option>
              <option value="email-asc">{copy.sortEmailAsc}</option>
              <option value="email-desc">{copy.sortEmailDesc}</option>
            </SelectControl>
          </div>
        </div>

        {users.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-muted-foreground">{copy.empty}</p>
        ) : visible.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-muted-foreground">{copy.noResults}</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {rows.map((user) => (
              <li
                key={user.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {user.name}
                    {user.id === currentUserId ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">{copy.you}</span>
                    ) : null}
                  </p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <SelectControl
                  className="w-full sm:w-44"
                  value={user.role}
                  disabled={savingId === user.id}
                  onChange={(event) => {
                    const role = event.target.value as Role;
                    if (role !== user.role) setPending({ user, role });
                  }}
                  aria-label={t("admin.people.roleFor", { name: user.name })}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </SelectControl>
              </li>
            ))}
          </ul>
        )}

        <Pager
          summary={
            <>
              {t("admin.people.accountTotal", { count: String(users.length) })}
              {visible.length !== users.length
                ? ` · ${t("admin.people.range", {
                    from: String(visible.length === 0 ? 0 : start + 1),
                    to: String(Math.min(start + PAGE_SIZE, visible.length)),
                    filtered: String(visible.length),
                  })}`
                : ""}
            </>
          }
          page={visible.length === 0 ? 0 : safePage + 1}
          pages={visible.length === 0 ? 0 : pageCount}
          pageLabel={t("admin.people.page", {
            page: String(visible.length === 0 ? 0 : safePage + 1),
            pages: String(visible.length === 0 ? 0 : pageCount),
          })}
          previousLabel={copy.previous}
          nextLabel={copy.next}
          onPrevious={() => setPage(safePage - 1)}
          onNext={() => setPage(safePage + 1)}
        />
      </CardContent>

      <ConfirmDialog
        open={pending !== null}
        title={copy.confirmRoleTitle}
        description={
          pending
            ? lastAdminBlocked
              ? copy.lastAdmin
              : t("admin.people.confirmRole", {
                  name: pending.user.name,
                  from: roleLabel(pending.user.role),
                  to: roleLabel(pending.role),
                })
            : undefined
        }
        confirmLabel={copy.confirmRoleAction}
        cancelLabel={copy.cancel}
        confirming={savingId !== null}
        confirmDisabled={lastAdminBlocked}
        onConfirm={() => void assignRole()}
        onCancel={() => {
          if (savingId === null) setPending(null);
        }}
      />
    </Card>
  );
}
