package com.aives.teaching.grading;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.aives.teaching.dto.DeskRecords.RubricCriterionItem;
import com.aives.teaching.grading.GradingResponseParser.InvalidGradingResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class GradingResponseParserTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final List<RubricCriterionItem> rubric = List.of(
            new RubricCriterionItem("c1", "Accuracy", "Facts are correct", 6, 0),
            new RubricCriterionItem("c2", "Reasoning", "Explains why", 4, 1)
    );

    @Test
    void computesScoreFromRubricCriteria() {
        String content = """
                ```json
                {"criteria":[{"criterion":1,"points":3,"comment":"half right"},{"criterion":2,"points":4}],
                 "isSufficient":false,"feedback":"Needs more detail.","followUpQuestion":"Why?"}
                ```
                """;
        Grade grade = GradingResponseParser.parse(content, rubric, mapper);
        assertEquals(70, grade.score());
        assertFalse(grade.sufficient());
        assertEquals("Why?", grade.followUpQuestion());
        assertEquals(2, grade.criteria().size());
        assertEquals("half right", grade.criteria().getFirst().comment());
    }

    @Test
    void clampsCriterionPointsToTheirMaximum() {
        String content = """
                {"criteria":[{"criterion":1,"points":600},{"criterion":2,"points":-3}],
                 "isSufficient":true,"feedback":"ok","followUpQuestion":null}
                """;
        Grade grade = GradingResponseParser.parse(content, rubric, mapper);
        assertEquals(60, grade.score());
        assertNull(grade.followUpQuestion());
    }

    @Test
    void rejectsMissingCriterion() {
        String content = """
                {"criteria":[{"criterion":1,"points":6}],"isSufficient":true,"feedback":"ok"}
                """;
        assertThrows(InvalidGradingResponse.class, () -> GradingResponseParser.parse(content, rubric, mapper));
    }

    @Test
    void rejectsMissingSufficiencyInsteadOfDefaultingToTrue() {
        String content = """
                {"score": 90, "feedback": "ok"}
                """;
        assertThrows(InvalidGradingResponse.class, () -> GradingResponseParser.parse(content, List.of(), mapper));
    }

    @Test
    void rejectsMissingScoreInsteadOfDefaultingTo75() {
        String content = """
                {"isSufficient": true, "feedback": "ok"}
                """;
        assertThrows(InvalidGradingResponse.class, () -> GradingResponseParser.parse(content, List.of(), mapper));
    }

    @Test
    void rejectsNonJson() {
        assertThrows(InvalidGradingResponse.class, () -> GradingResponseParser.parse("I give 100", List.of(), mapper));
    }

    @Test
    void usesScoreWhenThereIsNoRubric() {
        String content = """
                {"score": 140, "isSufficient": true, "feedback": "ok", "followUpQuestion": ""}
                """;
        Grade grade = GradingResponseParser.parse(content, List.of(), mapper);
        assertEquals(100, grade.score());
        assertNull(grade.followUpQuestion());
    }
}
