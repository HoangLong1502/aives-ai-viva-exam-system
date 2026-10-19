import type { Metadata } from "next";
import { AdminOverview } from "@/components/admin/dashboard/admin-overview";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function AdminPage() {
  return <AdminOverview />;
}
