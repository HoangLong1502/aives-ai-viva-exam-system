"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookOpenIcon, ClipboardListIcon, Loader2Icon, MicIcon, SparklesIcon } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLocale } from "@/lib/i18n/locale-provider";
import { homeForRole } from "@/lib/role-home";
import { useCurrentUser } from "@/lib/use-current-user";

export function HomeView({ portal }: { portal: "STUDENT" | "EXAMINER" }) {
  const router = useRouter();
  const { user, signOut } = useCurrentUser();
  const { t } = useLocale();

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return t("home.greetingMorning");
    if (hour < 18) return t("home.greetingAfternoon");
    return t("home.greetingEvening");
  }

  useEffect(() => {
    if (user && user.role !== portal) {
      router.replace(homeForRole(user.role));
    }
  }, [user, portal, router]);

  if (!user || user.role !== portal) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const firstName = user.name.split(" ")[0];
  const eyebrow =
    portal === "STUDENT" ? t("roles.student") : t("roles.teacher");
  const lead =
    portal === "STUDENT" ? t("home.studentLead") : t("home.teacherLead");

  return (
    <div className="min-h-svh bg-background">
      <AppHeader user={user} onSignOut={signOut} />

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <section className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="font-serif text-4xl tracking-tight md:text-5xl">
            {greeting()}, {firstName}.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
            {lead}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <InsightCard
            icon={MicIcon}
            title={t("home.upcomingVivas")}
            value="—"
            note={t("home.noSessionsYet")}
          />
          <InsightCard
            icon={ClipboardListIcon}
            title={t("home.completed")}
            value="0"
            note={t("home.resultsCollect")}
          />
          <InsightCard
            icon={SparklesIcon}
            title={t("home.readyTitle")}
            value={t("home.examHall")}
            note={t("home.banksNext")}
          />
        </section>

        <Card className="bg-card">
          <CardHeader className="border-b">
            <CardTitle className="font-serif text-2xl">{t("home.vivaSessions")}</CardTitle>
            <CardDescription>{t("home.assignedList")}</CardDescription>
          </CardHeader>
          <CardContent className="py-12">
            <div className="mx-auto flex max-w-md flex-col items-center text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                <BookOpenIcon className="size-5 text-muted-foreground" />
              </div>
              <h2 className="font-serif text-xl">{t("home.quietHall")}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("home.emptyStart")}
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  title,
  value,
  note,
}: {
  icon: typeof MicIcon;
  title: string;
  value: string;
  note: string;
}) {
  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex items-center justify-between">
          <CardDescription>{title}</CardDescription>
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <CardTitle className="font-serif text-3xl tracking-tight">
          {value}
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="text-sm text-muted-foreground">{note}</CardContent>
    </Card>
  );
}
