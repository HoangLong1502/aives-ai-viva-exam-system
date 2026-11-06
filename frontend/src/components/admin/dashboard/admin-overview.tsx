"use client";

import { DashboardView } from "@/components/admin/dashboard/dashboard-view";
import { useAdminDashboard } from "@/components/admin/dashboard/use-admin-dashboard";

export function AdminOverview() {
  const { stats, subjects, attempts, refreshing, refresh } = useAdminDashboard();

  // Keep the admin landing screen as a thin wrapper: fetch dashboard data and pass it
  // to the shared presentation component. This keeps the logic reusable across views.
  return (
    <DashboardView
      stats={stats}
      subjects={subjects}
      attempts={attempts}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}
