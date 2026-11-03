package com.aives.rag.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aives.rag.service.RubricDraftGenerator.DraftCriterion;
import com.aives.rag.service.RubricDraftGenerator.RubricDraft;
import com.aives.web.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class RubricDraftGeneratorTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void readsCriteriaThatAlreadySumToTheTotal() {
        RubricDraft draft = RubricDraftGenerator.parse("""
                ```json
                {"name":"Testing viva","description":"Oral answers on testing.","criteria":[
                  {"name":"Correctness","description":"Facts match the notes.","maxPoints":5},
                  {"name":"Terminology","description":"Uses testing terms.","maxPoints":3},
                  {"name":"Clarity","description":"Clear and structured.","maxPoints":2}]}
                ```
                """, 10, mapper);

        assertEquals("Testing viva", draft.name());
        assertEquals(List.of(5.0, 3.0, 2.0), draft.criteria().stream().map(DraftCriterion::maxPoints).toList());
        assertEquals("Facts match the notes.", draft.criteria().getFirst().description());
    }

    @Test
    void rescalesPointsToTheRequestedTotal() {
        RubricDraft draft = RubricDraftGenerator.parse("""
                {"criteria":[{"name":"A","maxPoints":40},{"name":"B","maxPoints":40},{"name":"C","maxPoints":20}]}
                """, 10, mapper);

        assertEquals(List.of(4.0, 4.0, 2.0), draft.criteria().stream().map(DraftCriterion::maxPoints).toList());
        assertEquals("Oral viva rubric", draft.name());
    }

    @Test
    void roundingDriftStillAddsUpToTheTotal() {
        List<DraftCriterion> scaled = RubricDraftGenerator.rescale(List.of(
                new DraftCriterion("A", "", 1),
                new DraftCriterion("B", "", 1),
                new DraftCriterion("C", "", 1)), 10);

        assertEquals(10.0, scaled.stream().mapToDouble(DraftCriterion::maxPoints).sum(), 1e-9);
        assertTrue(scaled.stream().allMatch(criterion -> criterion.maxPoints() >= 0.5));
    }

    @Test
    void missingPointsAreSharedEqually() {
        List<DraftCriterion> scaled = RubricDraftGenerator.rescale(List.of(
                new DraftCriterion("A", "", 0),
                new DraftCriterion("B", "", 0)), 10);

        assertEquals(List.of(5.0, 5.0), scaled.stream().map(DraftCriterion::maxPoints).toList());
    }

    @Test
    void rejectsARubricWithFewerThanTwoNamedCriteria() {
        assertThrows(ApiException.class, () -> RubricDraftGenerator.parse("""
                {"criteria":[{"name":"Only one","maxPoints":10},{"name":"  ","maxPoints":2}]}
                """, 10, mapper));
        assertThrows(ApiException.class, () -> RubricDraftGenerator.parse("not json", 10, mapper));
    }
}
