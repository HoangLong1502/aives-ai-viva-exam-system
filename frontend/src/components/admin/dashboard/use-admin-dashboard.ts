"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  dashboardErrorFrom,
  fetchAdminAttempts,
  fetchAdminStats,
  fetchAdminSubjects,
  parseAdminAttempts,
  parseAdminStats,
  parseAdminSubjects,
  type AdminAttempt,
  type AdminStats,
  type AdminSubject,
  type DashboardError,
} from "@/lib/admin/dashboard";

export type Resource<T> =
  | { status: "loading" }
  | { status: "error"; error: DashboardError }
  | { status: "success"; data: T };

export function useAdminDashboard() {
  const [stats, setStats] = useState<Resource<AdminStats>>({ status: "loading" });
  const [subjects, setSubjects] = useState<Resource<AdminSubject[]>>({ status: "loading" });
  const [attempts, setAttempts] = useState<Resource<AdminAttempt[]>>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [requestKey, setRequestKey] = useState(0);
  const requestRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestRef.current;

    void Promise.allSettled([
      fetchAdminStats(controller.signal),
      fetchAdminSubjects(controller.signal),
      fetchAdminAttempts(controller.signal),
    ]).then(([statsResult, subjectsResult, attemptsResult]) => {
      if (requestId !== requestRef.current) return;
      setStats(settle(statsResult, parseAdminStats));
      setSubjects(settle(subjectsResult, parseAdminSubjects));
      setAttempts(settle(attemptsResult, parseAdminAttempts));
      setRefreshing(false);
    });

    return () => {
      requestRef.current += 1;
      controller.abort();
    };
  }, [requestKey]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setStats((current) => (current.status === "success" ? current : { status: "loading" }));
    setSubjects((current) => (current.status === "success" ? current : { status: "loading" }));
    setAttempts((current) => (current.status === "success" ? current : { status: "loading" }));
    setRequestKey((value) => value + 1);
  }, []);

  return { stats, subjects, attempts, refreshing, refresh };
}

function settle<T>(
  result: PromiseSettledResult<unknown>,
  parse: (value: unknown) => T,
): Resource<T> {
  if (result.status === "rejected") {
    return { status: "error", error: dashboardErrorFrom(result.reason) };
  }
  try {
    return { status: "success", data: parse(result.value) };
  } catch {
    return { status: "error", error: { kind: "unexpected" } };
  }
}
