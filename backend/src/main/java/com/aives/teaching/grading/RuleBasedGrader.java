package com.aives.teaching.grading;

import com.aives.teaching.dto.DeskRecords.QuestionItem;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Keyword-overlap grader used when the AI grader is unavailable. It is deliberately conservative: it only
 * awards points for reference content it can find in the answer, and when the question has no model answer
 * or key points it gives a neutral score instead of guessing high. Its grades are always marked for review.
 */
public final class RuleBasedGrader {

    /** A key point earns full credit once this share of its significant words appears in the answer. */
    public static final double POINT_COVERAGE = 0.6;
    /** Share of the model answer's keywords that earns full marks when there are no key points. */
    public static final double FULL_MARKS_KEYWORD_COVERAGE = 0.6;
    /** Neutral score only when neither the question bank nor course materials give anything to compare. */
    public static final int NO_REFERENCE_SCORE = 40;

    private static final Pattern GAVE_UP = Pattern.compile(
            "(?iu)(không biết|khong biet|không nhớ|không rõ|em chịu|i don't know|i do not know|no idea|not sure)"
    );

    private static final Set<String> STOPWORDS = Set.of(
            // English
            "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "was", "were", "be",
            "it", "its", "this", "that", "these", "those", "with", "as", "by", "at", "from", "can", "has",
            "have", "not", "but", "which", "each", "one", "into", "than", "then", "so", "if", "also",
            // Vietnamese
            "là", "và", "của", "có", "các", "những", "một", "được", "cho", "với", "trong", "để", "khi",
            "này", "đó", "thì", "mà", "như", "từ", "về", "theo", "không", "nó", "ra", "vào", "cũng", "hay",
            "hoặc", "nên", "bị", "do", "đến", "rằng", "lại", "đã", "sẽ", "đang"
    );

    private RuleBasedGrader() {
    }

    public static Grade grade(QuestionItem question, String studentAnswer, boolean isFollowUp, boolean english) {
        return grade(question, studentAnswer, isFollowUp, english, List.of());
    }

    public static Grade grade(
            QuestionItem question,
            String studentAnswer,
            boolean isFollowUp,
            boolean english,
            List<String> courseMaterials
    ) {
        String answer = studentAnswer == null ? "" : studentAnswer.trim();
        if (answer.isBlank() || gaveUp(answer)) {
            return new Grade(
                    0,
                    false,
                    english
                            ? "It sounds like you cannot take this question further right now."
                            : "Có vẻ bạn chưa trả lời được câu này.",
                    null,
                    List.of(),
                    true
            );
        }
        Set<String> answerWords = words(answer);
        List<String> points = keyPoints(question.keyPoints());
        if (!points.isEmpty()) {
            return byKeyPoints(question, points, answerWords, answer, isFollowUp, english);
        }
        Set<String> reference = words(question.expectedAnswer());
        if (reference.isEmpty()) {
            reference = materialWords(courseMaterials);
        }
        if (reference.isEmpty()) {
            reference = words(question.prompt());
        }
        if (!reference.isEmpty()) {
            return byModelAnswer(question, reference, answerWords, isFollowUp, english);
        }
        String followUp = english
                ? "Could you explain the main idea of this question in your own words?"
                : "Em có thể trình bày lại ý chính của câu hỏi bằng lời của mình không?";
        return new Grade(
                NO_REFERENCE_SCORE,
                false,
                english
                        ? "Your answer was recorded. Please add a clearer explanation of the main points."
                        : "Câu trả lời đã được ghi nhận. Em hãy bổ sung rõ hơn các ý chính.",
                followUp,
                List.of(),
                false
        );
    }

    private static Set<String> materialWords(List<String> materials) {
        if (materials == null || materials.isEmpty()) {
            return Set.of();
        }
        StringBuilder joined = new StringBuilder();
        for (String material : materials) {
            if (material != null && !material.isBlank()) {
                joined.append(' ').append(material);
            }
        }
        return words(joined.toString());
    }

    private static Grade byKeyPoints(
            QuestionItem question,
            List<String> points,
            Set<String> answerWords,
            String answer,
            boolean isFollowUp,
            boolean english
    ) {
        String lowerAnswer = answer.toLowerCase(Locale.ROOT);
        double coverageSum = 0;
        int matched = 0;
        String missingPoint = null;
        for (String point : points) {
            double coverage = coverage(point, answerWords, lowerAnswer);
            coverageSum += Math.min(1.0, coverage / POINT_COVERAGE);
            if (coverage >= POINT_COVERAGE) {
                matched++;
            } else if (missingPoint == null) {
                missingPoint = point;
            }
        }
        int score = (int) Math.round(100.0 * coverageSum / points.size());
        boolean sufficient = matched * 2 >= points.size();
        return result(question, score, sufficient, isFollowUp, missingPoint, english);
    }

    private static Grade byModelAnswer(
            QuestionItem question,
            Set<String> reference,
            Set<String> answerWords,
            boolean isFollowUp,
            boolean english
    ) {
        long found = reference.stream().filter(answerWords::contains).count();
        double coverage = (double) found / reference.size();
        int score = (int) Math.round(100.0 * Math.min(1.0, coverage / FULL_MARKS_KEYWORD_COVERAGE));
        boolean sufficient = score >= 50;
        return result(question, score, sufficient, isFollowUp, null, english);
    }

    private static Grade result(
            QuestionItem question,
            int score,
            boolean sufficient,
            boolean isFollowUp,
            String missingPoint,
            boolean english
    ) {
        String positive = english
                ? "Your answer covered the main points about " + question.topic() + "."
                : "Câu trả lời của bạn đã bao quát các ý trọng tâm về " + question.topic() + ".";
        if (score >= 100) {
            return new Grade(score, true, positive, null, List.of(), false);
        }
        String feedback = english
                ? "Your answer is missing important points from the expected answer."
                : "Câu trả lời còn thiếu các ý quan trọng so với đáp án.";
        if (isFollowUp && score < 30) {
            return new Grade(score, false, feedback, null, List.of(), true);
        }
        if (isFollowUp && sufficient && missingPoint == null) {
            return new Grade(score, true, positive, null, List.of(), false);
        }
        String followUp;
        if (missingPoint != null) {
            followUp = english
                    ? "Could you explain more about: " + missingPoint + "?"
                    : "Em có thể nói rõ hơn về khía cạnh: " + missingPoint + " được không?";
        } else if (sufficient) {
            followUp = english
                    ? "You have the main idea. What important detail is still missing?"
                    : "Bạn đã nắm ý chính. Em bổ sung chi tiết còn thiếu được không?";
        } else {
            followUp = english
                    ? "Could you add a concrete example or a deeper analysis?"
                    : "Em có thể bổ sung thêm ví dụ thực tế hoặc phân tích sâu hơn được không?";
        }
        return new Grade(score, sufficient, sufficient ? positive : feedback, followUp, List.of(), false);
    }

    private static boolean gaveUp(String answer) {
        return words(answer).size() <= 8 && GAVE_UP.matcher(answer).find();
    }

    public static double coverage(String point, Set<String> answerWords, String lowerAnswer) {
        Set<String> pointWords = words(point);
        if (pointWords.isEmpty()) {
            return lowerAnswer.contains(point.toLowerCase(Locale.ROOT)) ? 1 : 0;
        }
        long found = pointWords.stream().filter(answerWords::contains).count();
        return (double) found / pointWords.size();
    }

    public static List<String> keyPoints(String keyPoints) {
        if (keyPoints == null) {
            return List.of();
        }
        return Arrays.stream(keyPoints.split("[;,\n]"))
                .map(String::trim)
                .filter(point -> !point.isBlank())
                .toList();
    }

    public static Set<String> words(String text) {
        if (text == null || text.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(text.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+"))
                .filter(word -> word.length() >= 2 && !STOPWORDS.contains(word))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
