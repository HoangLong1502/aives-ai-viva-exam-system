import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-xl font-serif text-lg leading-none tracking-tight",
        inverted
          ? "bg-amber-200/15 text-amber-100 ring-1 ring-amber-100/20"
          : "bg-linear-to-br from-primary to-[oklch(0.22_0.06_262)] text-primary-foreground shadow-[0_1px_0_0_oklch(1_0_0/0.15)_inset,0_4px_10px_-4px_oklch(0.22_0.035_255/0.5)] after:absolute after:-top-0.5 after:-right-0.5 after:size-2 after:rounded-full after:bg-highlight after:ring-2 after:ring-background",
        className,
      )}
    >
      A
    </span>
  );
}
