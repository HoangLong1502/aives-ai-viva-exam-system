package com.aives.teaching.grading;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class RuleBasedGraderTest {

    private static final String PROMPT = "What is a primary key in a database table?";

    @Test
    void wrongAnswerWithoutKeyPointsIsNotGivenHighMarks() {
        var question = GradingTestData.question(PROMPT, "A primary key uniquely identifies each row in a table.", null);
        Grade grade = RuleBasedGrader.grade(question,
                "I think it is a kind of password that is used for logging in to the computer system quickly.",
                false, true);
        assertTrue(grade.score() < 30, "score was " + grade.score());
        assertFalse(grade.sufficient());
        assertNotNull(grade.followUpQuestion());
    }

    @Test
    void goodAnswerAgainstModelAnswerScoresWell() {
        var question = GradingTestData.question(PROMPT, "A primary key uniquely identifies each row in a table.", null);
        Grade grade = RuleBasedGrader.grade(question, "It uniquely identifies every row of the table.", false, true);
        assertTrue(grade.score() >= 80, "score was " + grade.score());
        assertTrue(grade.sufficient());
    }

    @Test
    void keyPointsMatchByWordsNotExactPhrase() {
        var question = GradingTestData.question(PROMPT, null, "unique identifier; one per table; no null values");
        Grade grade = RuleBasedGrader.grade(question,
                "Each table has one primary key, it is a unique identifier and it cannot have null values.",
                false, true);
        assertTrue(grade.score() >= 90, "score was " + grade.score());
        assertTrue(grade.sufficient());
    }

    @Test
    void missingKeyPointsAsksAboutTheFirstMissingOne() {
        var question = GradingTestData.question(PROMPT, null, "unique identifier; one per table; no null values");
        Grade grade = RuleBasedGrader.grade(question, "It is a unique identifier.", false, true);
        assertFalse(grade.sufficient());
        assertTrue(grade.followUpQuestion().contains("one per table"));
        assertTrue(grade.score() < 50, "score was " + grade.score());
    }

    @Test
    void missingModelAnswerUsesCourseMaterials() {
        var question = GradingTestData.question(PROMPT, null, null);
        Grade grade = RuleBasedGrader.grade(
                question,
                "A primary key uniquely identifies each row in a table.",
                false,
                true,
                List.of("A primary key uniquely identifies each row in a table and must not be null.")
        );
        assertTrue(grade.score() >= 70, "score was " + grade.score());
        assertFalse(grade.sufficient() && grade.score() < 100);
    }

    @Test
    void noReferenceStillAsksAFollowUpInsteadOfHandingOffToTeacher() {
        var question = GradingTestData.question("???", null, null);
        Grade grade = RuleBasedGrader.grade(question, "Anything at all", false, true, List.of());
        assertNotNull(grade.followUpQuestion());
        assertFalse(grade.sufficient());
    }

    @Test
    void blankAnswerScoresZero() {
        var question = GradingTestData.question(PROMPT, "A primary key uniquely identifies each row.", null);
        Grade grade = RuleBasedGrader.grade(question, "  ", false, true);
        assertEquals(0, grade.score());
        assertFalse(grade.sufficient());
        assertTrue(grade.studentStuck());
    }

    @Test
    void givingUpIsStuck() {
        var question = GradingTestData.question(PROMPT, "A primary key uniquely identifies each row.", null);
        Grade grade = RuleBasedGrader.grade(question, "I don't know", false, true);
        assertTrue(grade.studentStuck());
        assertEquals(null, grade.followUpQuestion());
    }

    @Test
    void vietnameseKeyPoints() {
        var question = GradingTestData.question("Khóa chính là gì?", null, "định danh duy nhất; không được rỗng");
        Grade grade = RuleBasedGrader.grade(question,
                "Khóa chính dùng để định danh duy nhất mỗi dòng và không được rỗng.", false, false);
        assertEquals(100, grade.score());
    }
}
