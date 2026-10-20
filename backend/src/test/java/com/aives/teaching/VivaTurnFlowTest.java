package com.aives.teaching;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;

class VivaTurnFlowTest {

    @Test
    void fullMarksMoveToTheNextQuestion() {
        VivaTurnFlow.Decision decision = VivaTurnFlow.decide(grade(100, true, "Why?", false), 0);
        assertEquals(VivaTurnFlow.NEXT, decision.nextAction());
        assertNull(decision.followUpQuestion());
    }

    @Test
    void partialAnswerKeepsTheFollowUp() {
        VivaTurnFlow.Decision decision = VivaTurnFlow.decide(grade(40, false, "What about nulls?", false), 0);
        assertEquals(VivaTurnFlow.FOLLOW_UP, decision.nextAction());
        assertEquals("What about nulls?", decision.followUpQuestion());
    }

    @Test
    void stuckStudentIsAskedWhetherToContinue() {
        VivaTurnFlow.Decision decision = VivaTurnFlow.decide(grade(0, false, "Say more?", true), 0);
        assertEquals(VivaTurnFlow.ASK_CONTINUE, decision.nextAction());
        assertNull(decision.followUpQuestion());
    }

    @Test
    void tooManyFollowUpsStopProbing() {
        VivaTurnFlow.Decision decision = VivaTurnFlow.decide(
                grade(55, false, "One more detail?", false),
                VivaTurnFlow.MAX_FOLLOW_UPS
        );
        assertEquals(VivaTurnFlow.ASK_CONTINUE, decision.nextAction());
        assertNull(decision.followUpQuestion());
    }

    @Test
    void incompleteScoreAsksWhetherToContinue() {
        VivaTurnFlow.Decision decision = VivaTurnFlow.decide(grade(50, true, null, false), 1);
        assertEquals(VivaTurnFlow.ASK_CONTINUE, decision.nextAction());
    }

    private static Grade grade(int score, boolean sufficient, String followUp, boolean stuck) {
        return new Grade(score, sufficient, "Noted.", followUp, List.of(), stuck);
    }
}
