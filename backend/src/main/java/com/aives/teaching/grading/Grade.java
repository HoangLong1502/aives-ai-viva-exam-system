package com.aives.teaching.grading;

import com.aives.teaching.dto.DeskRecords.CriterionScore;
import java.util.List;

/**
 * One graded answer, on a 0-100 scale, before it is attached to a turn.
 *
 * @param studentStuck the student cannot usefully continue this question
 */
public record Grade(
        int score,
        boolean sufficient,
        String feedback,
        String followUpQuestion,
        List<CriterionScore> criteria,
        boolean studentStuck
) {
}
