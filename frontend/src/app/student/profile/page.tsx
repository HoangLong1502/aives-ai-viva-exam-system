"use client";

import { PageHeader } from "@/components/admin/ui/dashboard-ui";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { MailIcon, PhoneIcon, IdCardIcon, PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { User } from "@/lib/types";
import { USER_UPDATED_EVENT } from "@/lib/use-current-user";

type Profile = User & {
  phone: string | null;
  studentCode: string | null;
};

const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;

export default function StudentProfilePage() {
  const { t } = useLocale();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Profile>("/api/profile", { auth: true })
      .then((result) => {
        if (!cancelled) setProfile(result);
      })
      .catch(() => {
        if (!cancelled) toast.error(t("student_profile.load_failed"));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  function startEditing() {
    if (!profile) return;
    setName(profile.name);
    setPhone(profile.phone ?? "");
    setError(null);
    setIsEditing(true);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      setError(t("student_profile.name_required"));
      return;
    }
    if (trimmedPhone && !PHONE_PATTERN.test(trimmedPhone)) {
      setError(t("student_profile.phone_invalid"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await api<Profile>("/api/profile", {
        method: "PUT",
        auth: true,
        body: { name: trimmedName, phone: trimmedPhone },
      });
      setProfile(updated);
      setIsEditing(false);
      window.dispatchEvent(
        new CustomEvent<User>(USER_UPDATED_EVENT, {
          detail: { id: updated.id, email: updated.email, name: updated.name, role: updated.role },
        }),
      );
      toast.success(t("student_profile.saved"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("student_profile.save_failed"));
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return <div className="mx-auto max-w-2xl p-6 text-muted-foreground">…</div>;
  }

  const initials =
    profile.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  return (
    <div className="space-y-6">
      <PageHeader title={t("student_profile.title")} />

      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="flex items-center gap-4">
            <div
              className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif text-2xl text-primary"
              aria-hidden
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-2xl">{profile.name}</p>
              <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
            </div>
            {!isEditing ? (
              <Button type="button" variant="outline" onClick={startEditing}>
                <PencilIcon className="size-4" />
                {t("student_profile.edit")}
              </Button>
            ) : null}
          </div>

          {!isEditing ? (
            <dl className="divide-y rounded-xl border">
              <InfoRow icon={<MailIcon className="size-4" />} label={t("student_profile.email")} value={profile.email} />
              <InfoRow icon={<PhoneIcon className="size-4" />} label={t("student_profile.phone")} value={profile.phone} />
              <InfoRow
                icon={<IdCardIcon className="size-4" />}
                label={t("student_profile.student_code")}
                value={profile.studentCode}
              />
            </dl>
          ) : (
            <form onSubmit={handleUpdate} className="space-y-4">
              <Field>
                <FieldLabel htmlFor="profile-name">{t("student_profile.full_name")}</FieldLabel>
                <Input id="profile-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-email">{t("student_profile.email")}</FieldLabel>
                <Input id="profile-email" type="email" value={profile.email} disabled />
                <p className="text-xs text-muted-foreground">{t("student_profile.email_readonly")}</p>
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-phone">{t("student_profile.phone")}</FieldLabel>
                <Input id="profile-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>
                  {t("student_profile.save")}
                </Button>
                <Button type="button" variant="outline" disabled={saving} onClick={() => setIsEditing(false)}>
                  {t("student_profile.cancel")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <dt className="w-32 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-medium">{value || "—"}</dd>
    </div>
  );
}
