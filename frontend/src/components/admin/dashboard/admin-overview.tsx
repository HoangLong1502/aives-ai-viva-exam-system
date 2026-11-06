git"use client";

import { DashboardView } from "@/components/admin/dashboard/dashboard-view";
import { useAdminDashboard } from "@/components/admin/dashboard/use-admin-dashboard";

export function AdminOverview() {
  const { stats, subjects, attempts, refreshing, refresh } = useAdminDashboard();

  // Giữ màn hình tổng quan gọn nhẹ: lấy dữ liệu bằng hook rồi chuyển cho component
  // trình bày dùng chung để có thể tái sử dụng giao diện ở các màn hình khác.
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
