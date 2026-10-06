package com.aives.rag;

import com.aives.web.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;

public final class GeneratedQuestionParser {

    private GeneratedQuestionParser() {
    }

    public record Draft(String prompt, String source, String expectedAnswer, String keyPoints) {
    }

    public static List<Draft> parse(String content, int expectedCount, ObjectMapper mapper) {
        String json = unwrap(content);
        JsonNode root;
        try {
            root = mapper.readTree(json);
        } catch (Exception exception) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "The AI response was not valid JSON");
        }
        JsonNode questions = root.path("questions");
        if (!questions.isArray() || questions.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "The AI response did not include questions");
        }
        if (questions.size() > expectedCount) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "The AI response returned too many questions");
        }
        List<Draft> drafts = new ArrayList<>();
        for (JsonNode node : questions) {
            String prompt = text(node, "prompt");
            String source = text(node, "source");
            String expectedAnswer = firstText(node, "expectedAnswer", "expected_answer");
            String keyPoints = firstText(node, "keyPoints", "key_points");
            if (prompt.length() < 12 || source.isBlank()) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "A generated question was missing its prompt or source");
            }
            if (expectedAnswer.length() < 12 || keyPoints.isBlank()) {
                throw new ApiException(
                        HttpStatus.BAD_GATEWAY,
                        "A generated question was missing its expected answer or key points from the material"
                );
            }
            drafts.add(new Draft(prompt, source, expectedAnswer, keyPoints));
        }
        return drafts;
    }

    static String unwrap(String content) {
        String trimmed = content == null ? "" : content.trim();
        if (trimmed.startsWith("```")) {
            int start = trimmed.indexOf('\n');
            int end = trimmed.lastIndexOf("```");
            if (start > 0 && end > start) {
                return trimmed.substring(start + 1, end).trim();
            }
        }
        return trimmed;
    }

    private static String text(JsonNode node, String field) {
        return node.path(field).asText("").trim();
    }

    private static String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (!value.isBlank()) {
                return value;
            }
        }
        return "";
    }
}
