package com.aives.rag;

import com.aives.config.AppProperties;
import com.aives.rag.GeneratedQuestionParser.Draft;
import com.aives.web.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Service
public class VivaQuestionGenerator {

    private final AppProperties properties;
    private final ObjectMapper mapper;
    private final RestClient http;

    public VivaQuestionGenerator(AppProperties properties, ObjectMapper mapper) {
        this.properties = properties;
        this.mapper = mapper;
        this.http = RestClient.create();
    }

    public boolean configured() {
        return properties.ai().configured();
    }

    public String modelName() {
        return properties.ai().model();
    }

    public List<Draft> generate(String topic, String bloom, int count, List<Passage> passages) {
        if (!configured()) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "AI API is not configured. Set AI_BASE_URL, AI_API_KEY, and AI_MODEL."
            );
        }
        String base = properties.ai().baseUrl().replaceAll("/+$", "");
        String body;
        try {
            body = http.post()
                    .uri(base + "/chat/completions")
                    .header("Authorization", "Bearer " + properties.ai().apiKey())
                    .header("Content-Type", "application/json")
                    .header("HTTP-Referer", properties.frontendUrl())
                    .header("X-Title", "AIVES")
                    .body(requestBody(topic, bloom, count, passages))
                    .retrieve()
                    .body(String.class);
        } catch (RestClientResponseException exception) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, upstreamMessage(exception));
        } catch (RestClientException exception) {
            throw new ApiException(
                    HttpStatus.BAD_GATEWAY,
                    "The AI API could not be reached. If using OpenRouter, set AI_BASE_URL=https://openrouter.ai/api/v1"
            );
        }
        return GeneratedQuestionParser.parse(message(body), count, mapper);
    }

    private String upstreamMessage(RestClientResponseException exception) {
        String responseBody = exception.getResponseBodyAsString();
        if (responseBody != null && !responseBody.isBlank()) {
            try {
                JsonNode error = mapper.readTree(responseBody).path("error");
                String detail = error.path("message").asText("").trim();
                String code = error.path("code").asText("").trim();
                if (!detail.isBlank()) {
                    if ("credit_balance_exhausted".equals(code) || "insufficient_quota".equals(error.path("type").asText())) {
                        return "AI provider has no credits remaining. Add billing credits, then try again.";
                    }
                    if (exception.getStatusCode().value() == 402) {
                        return "AI provider needs credits or a free model (:free). " + detail;
                    }
                    return "AI API error: " + detail;
                }
            } catch (Exception ignored) {
                // fall through to status-based message
            }
        }
        int status = exception.getStatusCode().value();
        if (status == 401 || status == 403) {
            return "AI API rejected the API key. Check AI_API_KEY in backend/.env.";
        }
        if (status == 429) {
            return "AI API rate limit or quota exceeded. Check OpenAI billing and try again.";
        }
        return "AI API returned HTTP " + status;
    }

    private Map<String, Object> requestBody(String topic, String bloom, int count, List<Passage> passages) {
        StringBuilder context = new StringBuilder();
        for (int i = 0; i < passages.size(); i++) {
            Passage passage = passages.get(i);
            context.append('[').append(i + 1).append("] ")
                    .append(passage.source())
                    .append("\n")
                    .append(passage.text())
                    .append("\n\n");
        }
        String user = """
                Topic: %s
                Bloom level: %s
                Number of questions: %d

                Course passages:
                %s
                """.formatted(topic, bloom, count, context);
        return Map.of(
                "model", properties.ai().model(),
                "temperature", 0.2,
                "max_tokens", Math.min(2000, Math.max(400, count * 250)),
                "messages", List.of(
                        Map.of("role", "system", "content", """
                                You write oral viva questions grounded only in the supplied passages.
                                Return JSON with the shape {"questions":[{"prompt":"...","source":"filename, page 2"}]}.
                                Each source must name the passage you used. Do not add facts that are not in the passages.
                                """),
                        Map.of("role", "user", "content", user)
                )
        );
    }

    private String message(String body) {
        try {
            JsonNode content = mapper.readTree(body).path("choices").path(0).path("message").path("content");
            if (content.isMissingNode() || content.asText().isBlank()) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "The AI response did not include a message");
            }
            return content.asText();
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "The AI response could not be read");
        }
    }

    public record Passage(String source, String text) {
    }
}
