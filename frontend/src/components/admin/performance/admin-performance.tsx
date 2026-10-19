"use client";

import { useState } from "react";
import { ScoreTable } from "@/components/score-table";
import { PageHeader } from "@/components/admin/ui/dashboard-ui";
import { SelectControl } from "@/components/admin/ui/controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/lib/i18n/locale-provider";
import { formatAttemptStatus } from "@/lib/teacher/labels";

const STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "DRAFT", "PUBLISHED"] as const;

export function AdminPerformance() {
  const { messages } = useLocale();
  const copy = messages.admin.performance;
  const labels = messages.teacher.labels;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.lead} />

      <ScoreTable
        path="/api/admin/performance"
        search={search}
        statusFilter={status}
        toolbar={
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="result-search">{copy.searchLabel}</Label>
              <Input
                id="result-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={copy.searchPlaceholder}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="result-status">{copy.statusLabel}</Label>
              <SelectControl
                id="result-status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">{copy.allStatuses}</option>
                {STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {formatAttemptStatus(item, labels.attemptStatus)}
                  </option>
                ))}
              </SelectControl>
            </div>
          </div>
        }
      />
    </div>
  );
}
