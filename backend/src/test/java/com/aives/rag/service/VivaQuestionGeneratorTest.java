package com.aives.rag.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aives.rag.service.VivaQuestionGenerator.Passage;
import java.util.List;
import org.junit.jupiter.api.Test;

class VivaQuestionGeneratorTest {

    @Test
    void vietnameseSlidesAskForVietnameseQuestions() {
        String language = VivaQuestionGenerator.outputLanguage(
                "OOP",
                List.of(new Passage("bai-giang.pptx, trang 3", "Lớp là khuôn mẫu để tạo đối tượng."))
        );

        assertEquals("Vietnamese", language);
        String prompt = VivaQuestionGenerator.systemPrompt(language);
        assertTrue(prompt.contains("written entirely in Vietnamese"));
        assertTrue(prompt.contains("Do not translate them into another language."));
    }

    @Test
    void englishSlidesAskForEnglishQuestions() {
        String language = VivaQuestionGenerator.outputLanguage(
                "Lập trình",
                List.of(new Passage("lecture.pptx, page 3", "A class is a blueprint for creating objects."))
        );

        assertEquals("English", language);
        assertTrue(VivaQuestionGenerator.systemPrompt(language).contains("written entirely in English"));
    }
}
