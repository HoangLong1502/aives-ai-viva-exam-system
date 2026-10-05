import { StudentLayoutClient } from "@/components/layouts/student-layout-client";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentLayoutClient>{children}</StudentLayoutClient>;
}
