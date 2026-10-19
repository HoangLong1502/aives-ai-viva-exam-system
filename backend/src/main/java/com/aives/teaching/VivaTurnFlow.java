package com.aives.teaching;

/**
 * Decides what the oral exam does after an answer: advance, probe once more, or ask the student
 * whether to keep going on this question.
 */
final class VivaTurnFlow {

    static final int MAX_FOLLOW_UPS = 3;

    static final String NEXT = "NEXT";
    static final String FOLLOW_UP = "FOLLOW_UP";
    static final String ASK_CONTINUE = "ASK_CONTINUE";

    private VivaTurnFlow() {
    }

    record Decision(String nextAction, String followUpQuestion) {
    }

    /**
     * @param followUpDepth how many follow-up answers have now been given for this question, including the one just graded
     */
    static Decision decide(Grade grade, int followUpDepth) {
        // Only a complete answer advances. "Sufficient" alone must not skip the rest of the dialogue.
        if (grade.score() >= 100) {
            return new Decision(NEXT, null);
        }
        if (grade.studentStuck() || followUpDepth >= MAX_FOLLOW_UPS) {
            return new Decision(ASK_CONTINUE, null);
        }
        if (grade.followUpQuestion() != null && !grade.followUpQuestion().isBlank()) {
            return new Decision(FOLLOW_UP, grade.followUpQuestion().trim());
        }
        return new Decision(ASK_CONTINUE, null);
    }
}
