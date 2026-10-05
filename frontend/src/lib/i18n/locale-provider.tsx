"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en } from "./messages/en";
import { vi } from "./messages/vi";

export type Locale = "en" | "vi";

const STORAGE_KEY = "aives-locale";

const catalogs = { en, vi } as const;

type Catalog = (typeof catalogs)[Locale];

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
  messages: Catalog;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "en" || value === "vi") return value;
  } catch {
    /* private mode */
  }
  return null;
}

function resolveInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = readStoredLocale();
  if (stored) return stored;
  const lang = navigator.language.toLowerCase();
  return lang.startsWith("vi") ? "vi" : "en";
}

function lookup(messages: Catalog, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function format(template: string, params?: Record<string, string>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => params[name] ?? `{${name}}`);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(resolveInitialLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "vi" ? "vi" : "en";
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const messages = catalogs[locale];

  const t = useCallback(
    (key: string, params?: Record<string, string>) => {
      const text = lookup(messages, key) ?? lookup(catalogs.en, key) ?? key;
      return format(text, params);
    },
    [messages],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, messages }),
    [locale, setLocale, t, messages],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

export function useRoleLabel(role: "STUDENT" | "EXAMINER" | "ADMIN") {
  const { t } = useLocale();
  if (role === "STUDENT") return t("roles.student");
  if (role === "EXAMINER") return t("roles.teacher");
  return t("roles.admin");
}
