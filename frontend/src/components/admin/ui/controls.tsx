import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

const fieldClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

export function SelectControl({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClass, "h-8", className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, "py-2", className)} {...props} />;
}

export function TableScroller({ children }: { children: ReactNode }) {
  return <div className="min-w-0 max-w-full overflow-x-auto">{children}</div>;
}

export function Pager({
  summary,
  page,
  pages,
  pageLabel,
  previousLabel,
  nextLabel,
  busy = false,
  onPrevious,
  onNext,
}: {
  summary?: ReactNode;
  page: number;
  pages: number;
  pageLabel: string;
  previousLabel: string;
  nextLabel: string;
  busy?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : <span />}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || page <= 1}
          onClick={onPrevious}
        >
          {previousLabel}
        </Button>
        <p className="text-sm tabular-nums">{pageLabel}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || pages === 0 || page >= pages}
          onClick={onNext}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
