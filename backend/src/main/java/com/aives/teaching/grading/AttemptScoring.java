package com.aives.teaching.grading;

import java.util.List;
import java.util.Map;

/**
 * Computes an attempt's final score (0-100) from the per-question answer scores stored on the server.
 *
 * <p>The exam's {@value #TOTAL_POINTS} points are split across its questions in steps of {@value #STEP}
 * points, so no question is worth an ugly number like 11.111. Every question gets the same base share and
 * the leftover steps go to the first questions, e.g. 9 questions: two worth 11.5 and seven worth 11. The
 * split is the same for every student. A question the student never answered
 * counts as 0. When a question's best score comes from a follow-up turn, that better score is kept,
 * since the follow-up exists to let the student fill in the missing points.
 */
public final class AttemptScoring {

    public static final int TOTAL_POINTS = 100;
    public static final double STEP = 0.5;

    private AttemptScoring() {
    }

    /** Maximum points of each question, in exam order, on an exam with {@code questionCount} questions. Sums to 100. */
    public static double[] allocation(int questionCount) {
        double[] points = new double[Math.max(questionCount, 0)];
        if (questionCount <= 0) {
            return points;
        }
        int totalSteps = (int) Math.round(TOTAL_POINTS / STEP);
        int baseSteps = totalSteps / questionCount;
        int extraSteps = totalSteps % questionCount;
        for (int index = 0; index < questionCount; index++) {
            points[index] = (baseSteps + (index < extraSteps ? 1 : 0)) * STEP;
        }
        return points;
    }

    /**
     * @param questionIds     the questions on the exam
     * @param bestPercentages best answer score per question id, on a 0-100 scale
     */
    public static int finalScore(List<String> questionIds, Map<String, Double> bestPercentages) {
        if (questionIds.isEmpty()) {
            return 0;
        }
        double[] maxPoints = allocation(questionIds.size());
        double earned = 0;
        for (int index = 0; index < questionIds.size(); index++) {
            earned += maxPoints[index] * clamp(bestPercentages.getOrDefault(questionIds.get(index), 0.0)) / 100.0;
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
