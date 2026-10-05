"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { LanguageSwitch } from "@/components/language-switch";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { setSession } from "@/lib/auth";
import { useLocale } from "@/lib/i18n/locale-provider";
import { homeForRole } from "@/lib/role-home";
import type { LoginResponse, Role } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LoginScreen() {
  const router = useRouter();
  const { t, messages } = useLocale();
  const roleChoices: { value: Role; label: string }[] = [
    { value: "STUDENT", label: t("roles.student") },
    { value: "EXAMINER", label: t("roles.teacher") },
    { value: "ADMIN", label: t("roles.admin") },
  ];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  function finish(result: LoginResponse, chosenRole: Role) {
    if (result.user.role !== chosenRole) {
      const roleKey =
        result.user.role === "STUDENT"
          ? "roles.student"
          : result.user.role === "EXAMINER"
            ? "roles.teacher"
            : "roles.admin";
      toast.error(t("errors.roleMismatch", { role: t(roleKey) }));
      return;
    }
    setSession(result.accessToken);
    toast.success(t("login.welcome", { name: result.user.name.split(" ")[0] }));
    router.replace(homeForRole(result.user.role));
    router.refresh();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosenRole = mode === "create" ? "STUDENT" : selectedRole;
    if (!chosenRole) {
      toast.error(t("errors.chooseRole"));
      return;
    }
    setSubmitting(true);

    try {
      const result = await api<LoginResponse>(
        mode === "create" ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          body:
            mode === "create"
              ? { name, email, password }
              : { email, password },
        },
      );
      finish(result, chosenRole);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : t("errors.apiUnreachable");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogleCredential(idToken: string) {
    if (!selectedRole) {
      toast.error(t("errors.chooseRole"));
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<LoginResponse>("/api/auth/google", {
        method: "POST",
        body: { idToken },
      });
      finish(result, selectedRole);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : t("errors.apiUnreachable");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-svh lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden overflow-hidden bg-[#0b1c33] text-stone-100 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-28 size-[28rem] rounded-full border border-amber-200/10" />
          <div className="absolute -left-8 -top-12 size-[22rem] rounded-full border border-amber-200/10" />
          <div className="absolute bottom-[-8rem] right-[-6rem] size-[26rem] rounded-full bg-amber-300/8 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.09]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.45) 1px, transparent 1px)",
              backgroundSize: "4.5rem 4.5rem",
            }}
          />
        </div>

        <div className="relative flex items-center gap-3">
          <BrandMark inverted />
          <div>
            <p className="font-serif text-2xl tracking-tight">AIVES</p>
            <p className="text-[11px] uppercase tracking-[0.28em] text-amber-100/70">
              {t("brand.tagline")}
            </p>
          </div>
        </div>

        <div className="relative max-w-md space-y-8">
          <p className="font-serif text-4xl leading-tight tracking-tight xl:text-5xl">
            {t("login.heroTitle")}
          </p>
          <p className="max-w-sm text-sm leading-6 text-stone-300">
            {t("login.heroLead")}
          </p>
          <ul className="space-y-4 text-sm text-stone-300">
            {messages.login.heroBullets.map((item, index) => (
              <li key={item} className="flex gap-4">
                <span className="font-serif text-amber-200/90">
                  0{index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-stone-500">{t("login.heroFooter")}</p>
      </aside>

      <section className="relative flex items-center justify-center bg-background px-6 py-12">
        <div className="absolute right-6 top-6">
          <LanguageSwitch />
        </div>
        <div className="w-full max-w-[24.5rem]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <div>
              <p className="font-serif text-xl leading-none">AIVES</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.26em] text-muted-foreground">
                {t("brand.tagline")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {mode === "create" ? t("login.createAccount") : t("login.signIn")}
            </p>
            <h1 className="font-serif text-4xl tracking-tight">
              {mode === "create" ? t("login.joinHall") : t("login.enterHall")}
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {mode === "create" ? t("login.createLead") : t("login.signInLead")}
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <GoogleSignInButton disabled={submitting} onCredential={onGoogleCredential} />
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t("common.or")}
              <span className="h-px flex-1 bg-border" />
            </div>
          </div>

          <form className="mt-4 space-y-6" onSubmit={onSubmit}>
            {mode === "sign-in" ? (
              <fieldset>
                <legend className="text-sm font-medium">{t("login.roleLegend")}</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {roleChoices.map((choice) => {
                    const selected = selectedRole === choice.value;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        aria-pressed={selected}
                        className={cn(
                          "h-11 rounded-lg border text-sm",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background text-foreground hover:bg-muted",
                        )}
                        onClick={() => setSelectedRole(choice.value)}
                      >
                        {choice.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}
            <FieldGroup>
              {mode === "create" ? (
                <Field>
                  <FieldLabel htmlFor="name">{t("login.name")}</FieldLabel>
                  <Input
                    id="name"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Alex Rivera"
                    className="h-11 px-3"
                  />
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="email">{t("login.email")}</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@university.edu"
                  className="h-11 px-3"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">{t("login.password")}</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "create" ? "new-password" : "current-password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 px-3 pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? t("login.hidePassword") : t("login.showPassword")
                    }
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </button>
                </div>
                <FieldDescription>{t("login.passwordHint")}</FieldDescription>
              </Field>
            </FieldGroup>

            <Button
              type="submit"
              size="lg"
              className="h-11 w-full"
              disabled={submitting}
            >
                {submitting ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  {mode === "create"
                    ? t("login.creatingAccount")
                    : t("login.checkingCredentials")}
                </>
              ) : mode === "create" ? (
                t("login.createAccount")
              ) : (
                t("login.continue")
              )}
            </Button>
          </form>

          <p className="mt-4 text-sm text-muted-foreground">
            {mode === "create" ? t("login.alreadyHave") : t("login.newHere")}{" "}
            <Button
              type="button"
              variant="link"
              className="h-auto px-0 text-sm"
              onClick={() => setMode((current) => (current === "create" ? "sign-in" : "create"))}
            >
              {mode === "create" ? t("login.signIn") : t("login.createAnAccount")}
            </Button>
          </p>
        </div>
      </section>
    </main>
  );
}
