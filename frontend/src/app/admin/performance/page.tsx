import type { Metadata } from "next";
import { AdminPerformance } from "@/components/admin/performance/admin-performance";

export const metadata: Metadata = { title: "Results" };

export default function AdminPerformancePage() {
  return <AdminPerformance />;
}
