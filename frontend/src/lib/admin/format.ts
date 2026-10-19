export function formatAdminDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale === "vi" ? "vi" : "en", { dateStyle: "medium" });
}
