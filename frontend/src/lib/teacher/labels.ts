import type { Messages } from "@/lib/i18n/messages/en";

type TeacherLabels = Messages["teacher"]["labels"];

const BLOOM_VI: Record<string, string> = {
  REMEMBER: "Nhớ",
  UNDERSTAND: "Hiểu",
  APPLY: "Vận dụng",
  ANALYZE: "Phân tích",
};

const BLOOM_EN: Record<string, string> = {
  REMEMBER: "Remember",
  UNDERSTAND: "Understand",
  APPLY: "Apply",
  ANALYZE: "Analyze",
};

export function formatBloom(bloom: string, locale: "vi" | "en") {
  const map = locale === "vi" ? BLOOM_VI : BLOOM_EN;
  return map[bloom] ?? bloom;
}

export function formatQuestionStatus(
  status: string,
  labels: TeacherLabels["questionStatus"],
) {
  switch (status) {
    case "PENDING_REVIEW":
      return labels.pendingReview;
    case "APPROVED":
      return labels.approved;
    case "REJECTED":
      return labels.rejected;
    default:
      return status.replaceAll("_", " ");
  }
}

export function formatQuestionSource(
  source: string,
  labels: TeacherLabels["questionSource"],
) {
  switch (source) {
    case "AI":
      return labels.ai;
    case "MANUAL":
      return labels.manual;
    case "IMPORT":
      return labels.import;
    default:
      return source;
  }
}

export function formatExamFormat(format: string, labels: TeacherLabels["examFormat"]) {
  if (format === "ORAL") return labels.oral;
  if (format === "MULTIPLE_CHOICE") return labels.multipleChoice;
  return format;
}

export function formatAttemptStatus(
  status: string,
  labels: TeacherLabels["attemptStatus"],
) {
  switch (status) {
    case "ENTERED":
      return labels.entered;
    case "SCORED":
      return labels.scored;
    case "IN_PROGRESS":
      return labels.inProgress;
    default:
      return status.replaceAll("_", " ");
  }
}
