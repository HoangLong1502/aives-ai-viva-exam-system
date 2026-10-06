export type TeachingRubric = {
  id: string;
  name: string;
  criteria: string;
  maxScore: number;
  subjectId: string;
};

export type TeachingRubricCriterion = {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
  sortOrder: number;
};

export type TeachingRubricDetail = {
  id: string;
  name: string;
  description: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  criteria: TeachingRubricCriterion[];
  maxScore: number;
};

export function rubricEditHref(subjectId: string, rubricId: string, returnTo?: string) {
  const returnQuery = returnTo ? `?return=${encodeURIComponent(returnTo)}` : "";
  if (rubricId) {
    return `/teacher/rubrics/${rubricId}${returnQuery}`;
  }
  if (subjectId) {
    const subjectQuery = `subjectId=${encodeURIComponent(subjectId)}`;
    return `/teacher/rubrics?${subjectQuery}${returnTo ? `&return=${encodeURIComponent(returnTo)}` : ""}`;
  }
  return `/teacher/rubrics${returnQuery}`;
}

export function rubricsForSubject(rubrics: TeachingRubric[], subjectId: string) {
  if (!subjectId) return [];
  return rubrics.filter((rubric) => rubric.subjectId === subjectId);
}

export function resolveRubricIdForSubject(
  rubrics: TeachingRubric[],
  subjectId: string,
  currentRubricId: string,
) {
  const forSubject = rubricsForSubject(rubrics, subjectId);
  if (forSubject.some((rubric) => rubric.id === currentRubricId)) {
    return currentRubricId;
  }
  return forSubject[0]?.id ?? "";
}
