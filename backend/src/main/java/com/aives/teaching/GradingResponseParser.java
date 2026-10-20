package com.aives.teaching;

import com.aives.teaching.DeskRecords.CriterionScore;
import com.aives.teaching.DeskRecords.RubricCriterionItem;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads the grader's JSON strictly. A missing or malformed field is an error, never a default grade:
 * the caller then falls back to rule-based grading and says so.
 */
final class GradingResponseParser {

    private GradingResponseParser() {
    }

    static final class InvalidGradingResponse extends RuntimeException {
        InvalidGradingResponse(String message) {
            super(message);
        }
    }

    static Grade parse(String content, List<RubricCriterionItem> rubric, ObjectMapper mapper) {
        JsonNode data = readObject(content, mapper);

        JsonNode sufficient = data.get("isSufficient");
        if (sufficient == null || !sufficient.isBoolean()) {
            throw new InvalidGradingResponse("isSufficient is missing or not a boolean");
        }
        JsonNode feedback = data.get("feedback");
        if (feedback == null || !feedback.isTextual() || feedback.asText().isBlank()) {
            throw new InvalidGradingResponse("feedback is missing");
        }
        JsonNode followUpNode = data.get("followUpQuestion");
        String followUp = followUpNode != null && followUpNode.isTextual() && !followUpNode.asText().isBlank()
                ? followUpNode.asText().trim()
                : null;

        List<CriterionScore> criteria = List.of();
        int score;
        double possible = rubric.stream().mapToDouble(RubricCriterionItem::maxPoints).sum();
        if (rubric.isEmpty() || possible <= 0) {
            JsonNode scoreNode = data.get("score");
            if (scoreNode == null || !scoreNode.isNumber()) {
                throw new InvalidGradingResponse("score is missing or not a number");
            }
            score = (int) Math.round(clamp(scoreNode.asDouble(), 100));
        } else {
            criteria = criteria(data.get("criteria"), rubric);
            double earned = criteria.stream().mapToDouble(CriterionScore::points).sum();
            score = (int) Math.round(100.0 * earned / possible);
        }
        return new Grade(
                score,
                sufficient.asBoolean(),
                feedback.asText().trim(),
                followUp,
                criteria,
                studentStuck(data.get("studentStuck"))
        );
    }

    private static List<CriterionScore> criteria(JsonNode node, List<RubricCriterionItem> rubric) {
        if (node == null || !node.isArray()) {
            throw new InvalidGradingResponse("criteria is missing or not an array");
        }
        Map<Integer, JsonNode> byNumber = new HashMap<>();
        for (JsonNode entry : node) {
            JsonNode number = entry.get("criterion");
            JsonNode points = entry.get("points");
            if (number == null || !number.canConvertToInt() || points == null || !points.isNumber()) {
                throw new InvalidGradingResponse("a criterion entry has no number or points");
            }
            byNumber.put(number.asInt(), entry);
        }
        List<CriterionScore> scores = new ArrayList<>();
        for (int i = 0; i < rubric.size(); i++) {
            RubricCriterionItem criterion = rubric.get(i);
            JsonNode entry = byNumber.get(i + 1);
            if (entry == null) {
                throw new InvalidGradingResponse("criterion " + (i + 1) + " was not graded");
            }
            String comment = entry.path("comment").isTextual() ? entry.path("comment").asText().trim() : "";
            scores.add(new CriterionScore(
                    criterion.name(),
                    clamp(entry.get("points").asDouble(), criterion.maxPoints()),
                    criterion.maxPoints(),
                    comment
            ));
        }
        return scores;
    }

    private static JsonNode readObject(String content, ObjectMapper mapper) {
        if (content == null) {
            throw new InvalidGradingResponse("empty response");
        }
        int start = content.indexOf('{');
        int end = content.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new InvalidGradingResponse("response is not a JSON object");
        }
        try {
            JsonNode node = mapper.readTree(content.substring(start, end + 1));
            if (!node.isObject()) {
                throw new InvalidGradingResponse("response is not a JSON object");
            }
            return node;
        } catch (InvalidGradingResponse exception) {
            throw exception;
        } catch (Exception exception) {
            throw new InvalidGradingResponse("response is not valid JSON");
        }
    }

    /** Optional. A missing value means the student is still able to continue. */
    private static boolean studentStuck(JsonNode node) {
        if (node == null || node.isNull()) {
            return false;
        }
        if (!node.isBoolean()) {
            throw new InvalidGradingResponse("studentStuck is not a boolean");
        }
        return node.asBoolean();
    }

    private static double clamp(double value, double max) {
        if (Double.isNaN(value)) {
            return 0;
        }
        return Math.max(0, Math.min(max, value));
    }
}
