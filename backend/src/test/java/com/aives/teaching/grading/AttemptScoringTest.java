package com.aives.teaching.grading;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
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
        assertArrayEquals(new double[] {50.0, 50.0}, AttemptScoring.allocation(2));
        assertArrayEquals(new double[] {25.0, 25.0, 25.0, 25.0}, AttemptScoring.allocation(4));
        // (80% of 50) + (40% of 50) = 60
        assertEquals(60, AttemptScoring.finalScore(List.of("q1", "q2"), Map.of("q1", 80.0, "q2", 40.0)));
    }

    @Test
    void pointsSplitInHalfPointStepsAndAlwaysSumToTotal() {
        // 100 / 9 -> the two leftover half-point steps go to the first two questions
        assertArrayEquals(
                new double[] {11.5, 11.5, 11, 11, 11, 11, 11, 11, 11}, AttemptScoring.allocation(9));
        assertArrayEquals(new double[] {14.5, 14.5, 14.5, 14.5, 14, 14, 14}, AttemptScoring.allocation(7));
        for (int count = 1; count <= 40; count++) {
            double total = 0;
            for (double points : AttemptScoring.allocation(count)) {
                total += points;
            }
            assertEquals(100.0, total, "questionCount=" + count);
        }
    }

    @Test
    void clampsOutOfRangeScores() {
        assertEquals(100, AttemptScoring.finalScore(List.of("q1"), Map.of("q1", 250.0)));
        assertEquals(0, AttemptScoring.finalScore(List.of("q1"), Map.of("q1", -5.0)));
    }

    @Test
    void emptyExamScoresZero() {
        assertEquals(0, AttemptScoring.finalScore(List.of(), Map.of("q1", 100.0)));
        assertEquals(0, AttemptScoring.allocation(0).length);
    }
}
