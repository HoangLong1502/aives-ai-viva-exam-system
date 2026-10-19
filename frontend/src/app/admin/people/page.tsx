import type { Metadata } from "next";
import { AdminPeople } from "@/components/admin/people/admin-people";

export const metadata: Metadata = {
  title: "Accounts",
};

export default function AdminPeoplePage() {
  return <AdminPeople />;
}
