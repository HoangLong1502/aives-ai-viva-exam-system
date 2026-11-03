package com.aives.teaching.grading;

import com.aives.teaching.dto.DeskRecords.QuestionItem;

final class GradingTestData {

    private GradingTestData() {
    }

    static QuestionItem question(String prompt, String expectedAnswer, String keyPoints) {
        return new QuestionItem(
                "q1", "s1", "Databases", "Keys", prompt, "EASY", "r1", "Default", "", 10,
                "APPROVED", "MANUAL", "Teacher", null, expectedAnswer, keyPoints
        );
    }
}
