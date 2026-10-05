package com.aives.teaching;

import java.util.List;

public final class DeskRecords {

    private DeskRecords() {
    }

    public record SubjectItem(String id, String code, String name, List<String> teacherIds) {
    }

    public record RubricItem(String id, String name, String criteria, int maxScore, String subjectId) {
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
            String sourceRef
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

    public record SpeechSettings(String sttLanguage, String ttsLanguage) {
    }
}
