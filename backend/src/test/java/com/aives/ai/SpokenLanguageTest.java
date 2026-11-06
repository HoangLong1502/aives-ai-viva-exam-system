package com.aives.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class SpokenLanguageTest {

    @Test
    void vietnameseDiacriticsStayVietnamese() {
        assertEquals("Vietnamese", SpokenLanguage.of("Trình bày sự khác nhau giữa lớp và đối tượng."));
    }

    @Test
    void latinTextWithoutDiacriticsIsEnglish() {
        assertEquals("English", SpokenLanguage.of("Explain the difference between a class and an object."));
    }

    @Test
    void blankTextDefaultsToVietnamese() {
        assertEquals("Vietnamese", SpokenLanguage.of("  "));
        assertEquals("Vietnamese", SpokenLanguage.of(null));
    }
}
