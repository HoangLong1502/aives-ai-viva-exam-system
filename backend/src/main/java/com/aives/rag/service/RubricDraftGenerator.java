package com.aives.rag.service;

import com.aives.rag.parser.GeneratedQuestionParser;
import com.aives.ai.ChatCompletionClient;
import com.aives.ai.ChatCompletionClient.AiUnavailableException;
import com.aives.rag.service.VivaQuestionGenerator.Passage;
import com.aives.web.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Drafts an oral-viva rubric for a subject from its uploaded course material. The draft is only a
 * suggestion: nothing is saved until the teacher reviews it and saves it as a rubric.
 */
@Service
public class RubricDraftGenerator {

    private static final Logger log = LoggerFactory.getLogger(RubricDraftGenerator.class);
    static final int MIN_CRITERIA = 2;
    static final int MAX_CRITERIA = 8;

    private final ChatCompletionClient ai;
    private final ObjectMapper mapper;

    public RubricDraftGenerator(ChatCompletionClient ai, ObjectMapper mapper) {
        this.ai = ai;
        this.mapper = mapper;
    }

    public record DraftCriterion(String name, String description, double maxPoints) {
    }

    public record RubricDraft(String name, String description, List<DraftCriterion> criteria) {
    }

    public RubricDraft draft(String subjectName, String focus, int criteriaCount, double totalPoints, List<Passage> passages) {
        if (!ai.configured()) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "AI API is not configured. Set AI_BASE_URL, AI_API_KEY, and AI_MODEL."
            );
        }
        List<Map<String, Object>> messages = List.of(
                ChatCompletionClient.message("system", system(criteriaCount, totalPoints)),
                ChatCompletionClient.message("user", user(subjectName, focus, passages))
        );
        String reply;
        try {
            try {
                reply = ai.complete(body(messages, true)).content();
            } catch (AiUnavailableException jsonModeRejected) {
                log.warn("Rubric draft in JSON mode failed ({}); retrying without it", jsonModeRejected.getMessage());
                reply = ai.complete(body(messages, false)).content();
            }
        } catch (AiUnavailableException unavailable) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "The AI service is unavailable: " + unavailable.getMessage());
        }
        try {
            return parse(reply, totalPoints, mapper);
        } catch (ApiException invalid) {
            log.warn("Could not use the AI rubric draft ({}): {}", invalid.getMessage(),
                    reply.length() <= 500 ? reply : reply.substring(0, 500) + " ...");
            throw invalid;
        }
    }

    /** Reads the model's JSON and rescales the points so they add up to {@code totalPoints}. */
    static RubricDraft parse(String content, double totalPoints, ObjectMapper mapper) {
        JsonNode root;
        try {
            root = mapper.readTree(GeneratedQuestionParser.unwrap(content));
        } catch (Exception exception) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "The AI rubric was not valid JSON");
        }
        JsonNode items = root.path("criteria");
        if (!items.isArray() || items.size() < MIN_CRITERIA) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "The AI rubric needs at least " + MIN_CRITERIA + " criteria");
        }
        List<DraftCriterion> criteria = new ArrayList<>();
        for (JsonNode item : items) {
            if (criteria.size() == MAX_CRITERIA) {
                break;
            }
            String name = item.path("name").asText("").trim();
            double points = item.path("maxPoints").asDouble(item.path("points").asDouble(0));
            if (name.isEmpty()) {
                continue;
            }
            criteria.add(new DraftCriterion(name, item.path("description").asText("").trim(), Math.max(points, 0)));
        }
        if (criteria.size() < MIN_CRITERIA) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "The AI rubric needs at least " + MIN_CRITERIA + " named criteria");
        }
        String name = root.path("name").asText("").trim();
        return new RubricDraft(
                name.isEmpty() ? "Oral viva rubric" : name,
                root.path("description").asText("").trim(),
                rescale(criteria, totalPoints)
        );
    }

    /**
     * Keeps the model's relative weights but makes the points sum to the total, in half-point steps
     * with at least half a point each. Rounding drift goes to the heaviest criterion.
     */
    static List<DraftCriterion> rescale(List<DraftCriterion> criteria, double totalPoints) {
        double sum = criteria.stream().mapToDouble(DraftCriterion::maxPoints).sum();
        List<DraftCriterion> scaled = new ArrayList<>();
        for (DraftCriterion criterion : criteria) {
            double share = sum > 0 ? criterion.maxPoints() / sum : 1.0 / criteria.size();
            double points = Math.max(0.5, Math.round(share * totalPoints * 2) / 2.0);
            scaled.add(new DraftCriterion(criterion.name(), criterion.description(), points));
        }
        double drift = totalPoints - scaled.stream().mapToDouble(DraftCriterion::maxPoints).sum();
        if (Math.abs(drift) >= 0.25) {
            int heaviest = 0;
            for (int i = 1; i < scaled.size(); i++) {
                if (scaled.get(i).maxPoints() > scaled.get(heaviest).maxPoints()) {
                    heaviest = i;
                }
            }
            DraftCriterion top = scaled.get(heaviest);
            scaled.set(heaviest, new DraftCriterion(top.name(), top.description(), Math.max(0.5, top.maxPoints() + drift)));
        }
        return scaled;
    }

    private static Map<String, Object> body(List<Map<String, Object>> messages, boolean jsonMode) {
        Map<String, Object> body = new HashMap<>();
        body.put("messages", messages);
        body.put("temperature", 0.2);
        // Leaves room for reasoning models that think before answering.
        body.put("max_tokens", 4096);
        if (jsonMode) {
            body.put("response_format", Map.of("type", "json_object"));
        }
        return body;
    }

    private static String system(int criteriaCount, double totalPoints) {
        return """
                You design scoring rubrics for oral viva exams, where a student answers questions aloud and an AI examiner grades each answer against the rubric.
                Build ONE rubric for the whole subject from the supplied course passages.
                Rules:
                - Write exactly %d criteria. Each criterion judges one distinct quality of a spoken answer, for example correctness of the subject's core concepts, use of the subject's terminology, applying ideas to an example, reasoning or comparison, clarity and structure.
                - Make criteria specific to this subject: name the concepts from the passages that a good answer must get right.
                - description: one or two sentences telling the grader what earns full points and what loses points.
                - maxPoints: positive numbers that sum to %s. Give more points to the criteria that matter most.
                - Write name, description and criteria in the same language as the passages.
                Return JSON only, with this shape:
                {"name":"...","description":"...","criteria":[{"name":"...","description":"...","maxPoints":4}]}
                """.formatted(criteriaCount, formatPoints(totalPoints));
    }

    private static String user(String subjectName, String focus, List<Passage> passages) {
        StringBuilder context = new StringBuilder();
        for (int i = 0; i < passages.size(); i++) {
            Passage passage = passages.get(i);
            context.append('[').append(i + 1).append("] ").append(passage.source()).append('\n')
                    .append(passage.text()).append("\n\n");
        }
        return """
                Subject: %s
                Focus requested by the teacher: %s

                Course passages:
                %s
                """.formatted(subjectName, focus == null || focus.isBlank() ? "(whole subject)" : focus.trim(), context);
    }

    private static String formatPoints(double points) {
        return points == Math.rint(points) ? String.valueOf((long) points) : String.valueOf(points);
    }
}
