package com.aives.ai;

/**
 * The language a student is expected to speak. Vietnamese text is recognised by its diacritics;
 * Latin text without those marks is treated as English.
 */
public final class SpokenLanguage {

    private static final String VIETNAMESE_MARKS =
            "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ"
                    + "ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ";

    private SpokenLanguage() {
    }

    public static String of(String text) {
        if (text == null || text.isBlank()) {
            return "Vietnamese";
        }
        for (int i = 0; i < text.length(); i++) {
            if (VIETNAMESE_MARKS.indexOf(text.charAt(i)) >= 0) {
                return "Vietnamese";
            }
        }
        long letters = text.chars().filter(Character::isLetter).count();
        long ascii = text.chars().filter(c -> (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')).count();
        if (letters > 0 && (double) ascii / letters >= 0.85) {
            return "English";
        }
        return "Vietnamese";
    }
}
