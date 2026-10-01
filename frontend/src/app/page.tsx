"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { homeForRole } from "@/lib/role-home";
import { useCurrentUser } from "@/lib/use-current-user";

export default function HomePage() {
  const router = useRouter();
  const { user } = useCurrentUser();

  useEffect(() => {
    if (user) {
      router.replace(homeForRole(user.role));
    }
  }, [user, router]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
