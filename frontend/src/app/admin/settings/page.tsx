import type { Metadata } from "next";
import { AdminSettings } from "@/components/admin/settings/admin-settings";

export const metadata: Metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return <AdminSettings />;
}
