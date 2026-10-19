"use client";

import {
  BookOpenIcon,
  CalendarClockIcon,
  CircleDotIcon,
  GraduationCapIcon,
  ShieldIcon,
  UsersIcon,
} from "lucide-react";
import { AttentionList } from "@/components/admin/dashboard/attention-list";
import { AttemptTable, ResultsLink } from "@/components/admin/dashboard/attempt-table";
import {
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  SectionHeader,
} from "@/components/admin/ui/dashboard-ui";
import { ExamStatusPanel } from "@/components/admin/dashboard/exam-status-panel";
import { QuickActions } from "@/components/admin/dashboard/quick-actions";
import { StatCard } from "@/components/admin/dashboard/stat-card";
import type { Resource } from "@/components/admin/dashboard/use-admin-dashboard";
import {
  dashboardErrorMessage,
  type AdminAttempt,
  type AdminStats,
  type AdminSubject,
  type DashboardError,
} from "@/lib/admin/dashboard";
import { useLocale } from "@/lib/i18n/locale-provider";

export function DashboardView({
  stats,
  subjects,
  attempts,
  refreshing,
  onRefresh,
}: {
  stats: Resource<AdminStats>;
  subjects: Resource<AdminSubject[]>;
  attempts: Resource<AdminAttempt[]>;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t, locale, messages } = useLocale();
  const copy = messages.admin.dashboard;
  const statsCopy = copy.stats;
  const errorText = (error: DashboardError) => dashboardErrorMessage(error, copy.error);

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader eyebrow={t("brand.adminEyebrow")} title={t("nav.admin.dashboard")} />

      <section aria-label={t("nav.admin.dashboard")}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {stats.status === "loading" ? (
            <LoadingSkeleton className="h-40 sm:col-span-2" label={copy.loading} />
          ) : null}
          {stats.status === "error" ? (
            <div className="sm:col-span-2">
              <ErrorState
                title={copy.error.title}
                message={errorText(stats.error)}
                retryLabel={copy.retry}
                onRetry={onRefresh}
                disabled={refreshing}
              />
            </div>
          ) : null}
          {stats.status === "success" ? (
            <>
              <StatCard
                label={statsCopy.students}
                value={stats.data.students}
                scope={statsCopy.studentsScope}
                hint={statsCopy.studentsHint}
                href="/admin/people"
                icon={GraduationCapIcon}
              />
              <StatCard
                label={statsCopy.teachers}
                value={stats.data.teachers}
                scope={statsCopy.teachersScope}
                hint={statsCopy.teachersHint}
                href="/admin/people"
                icon={UsersIcon}
              />
              <StatCard
                label={statsCopy.inProgress}
                value={stats.data.multipleChoiceInProgress + stats.data.oralInProgress}
                scope={statsCopy.inProgressScope}
                hint={statsCopy.inProgressHint}
                href="#exam-status"
                icon={CircleDotIcon}
                emphasis
              />
              <StatCard
                label={statsCopy.scheduled}
                value={stats.data.multipleChoiceScheduled + stats.data.oralScheduled}
                scope={statsCopy.scheduledScope}
                hint={statsCopy.scheduledHint}
                href="#exam-status"
                icon={CalendarClockIcon}
              />
              <StatCard
                label={statsCopy.administrators}
                value={stats.data.administrators}
                scope={statsCopy.administratorsScope}
                hint={statsCopy.administratorsHint}
                href="/admin/people"
                icon={ShieldIcon}
              />
            </>
          ) : null}
          {subjects.status === "loading" ? (
            <LoadingSkeleton className="h-32" label={copy.loading} />
          ) : null}
          {subjects.status === "error" ? (
            <ErrorState
              title={copy.error.title}
              message={errorText(subjects.error)}
              retryLabel={copy.retry}
              onRetry={onRefresh}
              disabled={refreshing}
            />
          ) : null}
          {subjects.status === "success" ? (
            <StatCard
              label={statsCopy.subjects}
              value={subjects.data.length}
              scope={statsCopy.subjectsScope}
              hint={statsCopy.subjectsHint}
              href="/admin/settings"
              icon={BookOpenIcon}
            />
          ) : null}
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-5">
        <section id="exam-status" className="scroll-mt-24 space-y-4 xl:col-span-3" aria-labelledby="exam-status-heading">
          <SectionHeader id="exam-status-heading" title={copy.exams.title} />
          {stats.status === "loading" ? <LoadingSkeleton className="h-56" label={copy.loading} /> : null}
          {stats.status === "error" ? (
            <ErrorState
              title={copy.error.title}
              message={errorText(stats.error)}
              retryLabel={copy.retry}
              onRetry={onRefresh}
              disabled={refreshing}
            />
          ) : null}
          {stats.status === "success" ? <ExamStatusPanel stats={stats.data} copy={copy.exams} /> : null}
        </section>

        <section className="space-y-4 xl:col-span-2" aria-labelledby="attention-heading">
          <SectionHeader id="attention-heading" title={copy.attention.title} />
          {subjects.status === "loading" ? <LoadingSkeleton className="h-56" label={copy.loading} /> : null}
          {subjects.status === "error" ? (
            <ErrorState
              title={copy.error.title}
              message={errorText(subjects.error)}
              retryLabel={copy.retry}
              onRetry={onRefresh}
              disabled={refreshing}
            />
          ) : null}
          {subjects.status === "success" ? (
            <AttentionList
              subjects={subjects.data}
              copy={copy.attention}
              countLabel={(count) =>
                t("admin.dashboard.attention.subjectCount", { count: String(count) })
              }
            />
          ) : null}
        </section>
      </div>

      <section className="space-y-4" aria-labelledby="attempts-heading">
        <SectionHeader
          id="attempts-heading"
          title={copy.attempts.title}
          action={attempts.status === "success" ? <ResultsLink label={copy.attempts.viewAll} /> : null}
        />
        {attempts.status === "loading" ? <LoadingSkeleton className="h-72" label={copy.loading} /> : null}
        {attempts.status === "error" ? (
          <ErrorState
            title={copy.error.title}
            message={errorText(attempts.error)}
            retryLabel={copy.retry}
            onRetry={onRefresh}
            disabled={refreshing}
          />
        ) : null}
        {attempts.status === "success" ? (
          <AttemptTable
            attempts={attempts.data}
            copy={copy.attempts}
            examCopy={copy.exams}
            locale={locale}
          />
        ) : null}
      </section>

      <section className="space-y-4" aria-labelledby="actions-heading">
        <SectionHeader id="actions-heading" title={copy.actions.title} />
        <QuickActions copy={copy.actions} />
      </section>
    </div>
  );
}
