package com.aives.teaching.grading;

/**
 * Decides what the oral exam does after an answer: advance, probe once more, or ask the student
 * whether to keep going on this question.
 */
public final class VivaTurnFlow {

    /** Used when an exam has no stored setting; matches the exam_session.max_follow_ups default. */
    public static final int DEFAULT_MAX_FOLLOW_UPS = 2;

    public static final String NEXT = "NEXT";
    public static final String FOLLOW_UP = "FOLLOW_UP";
    public static final String ASK_CONTINUE = "ASK_CONTINUE";

    private VivaTurnFlow() {
    }

    public record Decision(String nextAction, String followUpQuestion) {
    }

    /**
     * @param followUpDepth how many follow-up answers have now been given for this question, including the one just graded
     * @param maxFollowUps   the exam's cap on follow-up questions per main question
     */
    public static Decision decide(Grade grade, int followUpDepth, int maxFollowUps) {
        // Only a complete answer advances. "Sufficient" alone must not skip the rest of the dialogue.
        if (grade.score() >= 100) {
            return new Decision(NEXT, null);
        }
        if (grade.studentStuck() || followUpDepth >= maxFollowUps) {
            return new Decision(ASK_CONTINUE, null);
        }
        if (grade.followUpQuestion() != null && !grade.followUpQuestion().isBlank()) {
            return new Decision(FOLLOW_UP, grade.followUpQuestion().trim());
        }
        return new Decision(ASK_CONTINUE, null);
    }
}
