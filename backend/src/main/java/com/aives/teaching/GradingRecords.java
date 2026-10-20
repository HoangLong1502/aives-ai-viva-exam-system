package com.aives.teaching;

import java.util.List;

public final class GradingRecords {

    private GradingRecords() {
    }

    public record CourseGradingItem(
            String id,
            String code,
            String name,
            int examCount,
            int submittedCount,
            int pendingCount
    ) {
    }

    public record ExamGradingItem(
            String id,
            String title,
            String status,
            String format,
            int participantCount,
            int submittedCount,
            int pendingCount,
            Double averageScore
    ) {
    }

    public record ParticipantItem(
            String attemptId,
            String studentId,
            String studentName,
            String studentCode,
            String status,
            Integer score,
            int answeredCount,
            int gradedCount
    ) {
    }

    /** Participants of one exam plus statistics over its submitted attempts. */
    public record ExamParticipants(
            String examId,
            String examTitle,
            String courseId,
            String courseName,
            int submittedCount,
            int gradedCount,
            Double averageScore,
            List<ParticipantItem> participants
    ) {
    }

    /** One asked turn (the main question or a follow-up) and what the student and the AI said about it. */
    public record TurnItem(
            String turnId,
            int turnNo,
            String turnType,
            String questionText,
            String transcript,
            boolean answered,
            Double aiScore,
            String aiFeedback,
            String evaluator
    ) {
    }

    /** An exam question with all of its turns; the teacher gives it a single mark. */
    public record QuestionGrading(
            String questionId,
            int number,
            String prompt,
            String expectedAnswer,
            String keyPoints,
            boolean answered,
            Double aiScore,
            Double teacherScore,
            String teacherFeedback,
            List<TurnItem> turns
    ) {
    }

    public record AttemptGrading(
            String attemptId,
            String examId,
            String examTitle,
            String courseId,
            String courseName,
            String studentName,
            String studentCode,
            String status,
            Integer score,
            double pointsPerQuestion,
            List<QuestionGrading> questions
    ) {
    }

    /** The attempt's recalculated 0-100 score after a teacher mark was saved. */
    public record GradedAttemptResult(int score) {
    }
}
