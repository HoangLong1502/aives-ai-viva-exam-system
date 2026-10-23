package com.aives.teaching.grading;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AttemptScoringTest {

    @Test
    void noAnswersScoresZero() {
        assertEquals(0, AttemptScoring.finalScore(List.of("q1", "q2"), Map.of()));
    }

    @Test
    void unansweredQuestionsCountAsZero() {
        assertEquals(45, AttemptScoring.finalScore(List.of("q1", "q2"), Map.of("q1", 90.0)));
    }

    @Test
    void everyQuestionIsWorthAnEqualShareOfTheTotal() {
        assertEquals(50.0, AttemptScoring.pointsPerQuestion(2));
        assertEquals(25.0, AttemptScoring.pointsPerQuestion(4));
        // (80% of 50) + (40% of 50) = 60
        assertEquals(60, AttemptScoring.finalScore(List.of("q1", "q2"), Map.of("q1", 80.0, "q2", 40.0)));
    }

    @Test
    void clampsOutOfRangeScores() {
        assertEquals(100, AttemptScoring.finalScore(List.of("q1"), Map.of("q1", 250.0)));
        assertEquals(0, AttemptScoring.finalScore(List.of("q1"), Map.of("q1", -5.0)));
    }

    @Test
    void emptyExamScoresZero() {
        assertEquals(0, AttemptScoring.finalScore(List.of(), Map.of("q1", 100.0)));
        assertEquals(0.0, AttemptScoring.pointsPerQuestion(0));
    }
}
