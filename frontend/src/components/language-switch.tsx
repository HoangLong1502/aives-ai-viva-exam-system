"use client";

import { cn } from "@/lib/utils";
import { useLocale, type Locale } from "@/lib/i18n/locale-provider";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "vi", label: "VI" },
  { value: "en", label: "EN" },
];

export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      role="group"
      aria-label={t("common.languageSwitch")}
      className={cn(
        "inline-flex rounded-lg border border-input bg-background p-0.5 text-xs font-medium",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const active = locale === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            className={cn(
              "min-w-9 rounded-md px-2 py-1 transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setLocale(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
