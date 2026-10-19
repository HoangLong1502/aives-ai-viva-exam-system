"use client";

import { DashboardView } from "@/components/admin/dashboard/dashboard-view";
import { useAdminDashboard } from "@/components/admin/dashboard/use-admin-dashboard";

export function AdminOverview() {
  const { stats, subjects, attempts, refreshing, refresh } = useAdminDashboard();

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
