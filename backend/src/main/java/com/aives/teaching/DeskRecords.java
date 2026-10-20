package com.aives.teaching;

import java.util.List;

public final class DeskRecords {

    private DeskRecords() {
    }

    public record SubjectItem(String id, String code, String name, List<String> teacherIds) {
    }

    public record RubricItem(String id, String name, String criteria, int maxScore, String subjectId) {
    }

    public record RubricCriterionItem(
            String id,
            String name,
            String description,
            double maxPoints,
            int sortOrder
    ) {
    }

    public record RubricDetailItem(
            String id,
            String name,
            String description,
            String subjectId,
            String subjectCode,
            String subjectName,
            List<RubricCriterionItem> criteria,
            int maxScore
    ) {
    }

    public record QuestionItem(
            String id,
            String subjectId,
            String subjectName,
            String topic,
            String prompt,
            String bloom,
            String rubricId,
            String rubricName,
            String criteria,
            int maxScore,
            String status,
            String source,
            String authorName,
            String sourceRef,
            String expectedAnswer,
            String keyPoints
    ) {
    }

    /** Question payload for students sitting an exam — no model answers. */
    public record ExamQuestionItem(
            String id,
            String topic,
            String prompt,
            String bloom,
            String rubricName,
            String criteria,
            int maxScore
    ) {
    }

    public record ExamListItem(
            String id,
            String title,
            String format,
            String status,
            String subjectId,
            String subjectName,
            int questionCount
    ) {
    }

    public record ExamDetailItem(
            String id,
            String title,
            String format,
            String status,
            String subjectId,
            String subjectName,
            List<QuestionItem> questions
    ) {
    }

    public record SessionItem(
            String id,
            String title,
            String format,
            String status,
            String subjectName,
            String teacherName,
            boolean entered,
            Integer score
    ) {
    }

    public record AttemptItem(
            String id,
            String examId,
            String examTitle,
            String studentName,
            String teacherName,
            Integer score,
            String status
    ) {
    }

    public record SpeechSettings(
            String sttLanguage,
            String ttsLanguage,
            String ttsVoice,
            String ttsVoiceEn
    ) {
    }

    public record AnswerSubmissionRequest(
            String answer,
            Integer durationMs,
            /** The follow-up the examiner just asked, when this answer continues a question. */
            String followUpQuestion
    ) {
    }

    /**
     * @param evaluator      {@code AI} or {@code RULE_BASED}; rule-based grades are provisional
     * @param fallbackReason why the AI grader was not used, or null when it was
     * @param criteria       per-rubric-criterion points when the AI graded against the rubric
     * @param nextAction     {@code NEXT}, {@code FOLLOW_UP}, or {@code ASK_CONTINUE}
     */
    public record VivaEvaluationItem(
            String turnId,
            String questionId,
            int score,
            boolean isSufficient,
            String feedback,
            String followUpQuestion,
            String evaluator,
            String fallbackReason,
            List<CriterionScore> criteria,
            String nextAction
    ) {
    }

    public record CriterionScore(String name, double points, double maxPoints, String comment) {
    }

    public record VivaTurnItem(
            String turnId,
            String questionId,
            String parentTurnId,
            int turnNo,
            String turnType,
            String questionText,
            String transcript,
            boolean needsFollowUp,
            String followUpReason
    ) {
    }

    /** Final score computed on the server from the stored answers. */
    public record SubmitAttemptResult(
            int score,
            int answeredQuestions,
            int totalQuestions
    ) {
    }
}
