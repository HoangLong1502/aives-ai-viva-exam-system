package com.aives.teaching.grading;

import java.util.List;
import java.util.Map;

/**
 * Computes an attempt's final score (0-100) from the per-question answer scores stored on the server.
 *
 * <p>The exam's {@value #TOTAL_POINTS} points are split equally across its questions, so every question
 * is worth {@code 100 / questionCount} points for every student. A question the student never answered
 * counts as 0. When a question's best score comes from a follow-up turn, that better score is kept,
 * since the follow-up exists to let the student fill in the missing points.
 */
public final class AttemptScoring {

    public static final int TOTAL_POINTS = 100;

    private AttemptScoring() {
    }

    /** Maximum points of one question on an exam with {@code questionCount} questions. */
    public static double pointsPerQuestion(int questionCount) {
        return questionCount <= 0 ? 0 : (double) TOTAL_POINTS / questionCount;
    }

    /**
     * @param questionIds     the questions on the exam
     * @param bestPercentages best answer score per question id, on a 0-100 scale
     */
    public static int finalScore(List<String> questionIds, Map<String, Double> bestPercentages) {
        if (questionIds.isEmpty()) {
            return 0;
        }
        double perQuestion = pointsPerQuestion(questionIds.size());
        double earned = 0;
        for (String questionId : questionIds) {
            earned += perQuestion * clamp(bestPercentages.getOrDefault(questionId, 0.0)) / 100.0;
        }
        return (int) Math.round(earned);
    }

    private static double clamp(Double value) {
        if (value == null || value.isNaN()) {
            return 0;
        }
        return Math.max(0, Math.min(100, value));
    }
}
