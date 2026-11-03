package com.aives.ai;

import java.util.Locale;

/**
 * Question difficulty, stored in {@code question.bloom_level}. The three levels fold Bloom's taxonomy:
 * remember + understand are EASY, apply is MEDIUM, analyse is HARD. Prompts send the definition along
 * with the level so the model does not have to guess what a bare "EASY" means.
 */
public final class Difficulty {

    public static final String DEFINITIONS = """
            Difficulty levels (based on Bloom's taxonomy):
            - EASY: remember and understand. Recall a definition, fact or term, or explain a concept in the student's own words.
            - MEDIUM: apply. Use a concept, method or formula from the material in a concrete situation or worked example.
            - HARD: analyse. Break a problem into parts, compare or contrast approaches, explain causes, trade-offs or why something works.""";

    private Difficulty() {
    }

    /** The level followed by its short meaning, e.g. "MEDIUM (apply)". */
    public static String describe(String level) {
        if (level == null || level.isBlank()) {
            return "";
        }
        String normalized = level.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "EASY" -> "EASY (remember / understand)";
            case "MEDIUM" -> "MEDIUM (apply)";
            case "HARD" -> "HARD (analyse)";
            default -> normalized;
        };
    }
}
