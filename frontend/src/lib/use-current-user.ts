"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { clearSession } from "@/lib/auth";
import type { MeResponse, User } from "@/lib/types";

export const USER_UPDATED_EVENT = "aives:user-updated";

export function useCurrentUser() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;

    api<MeResponse>("/api/auth/me", { auth: true })
      .then((result) => {
        if (!cancelled) {
          setUser(result.user);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
          return;
        }
        toast.error("Could not load your session.");
      });

    const onUpdated = (event: Event) => {
      setUser((event as CustomEvent<User>).detail);
    };
    window.addEventListener(USER_UPDATED_EVENT, onUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener(USER_UPDATED_EVENT, onUpdated);
    };
  }, [router]);

  function signOut() {
    clearSession();
    void api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return { user, setUser, signOut };
}
