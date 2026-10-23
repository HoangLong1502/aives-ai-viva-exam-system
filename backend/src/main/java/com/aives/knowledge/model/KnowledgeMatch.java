package com.aives.knowledge.model;

import java.util.UUID;

public record KnowledgeMatch(
        UUID id,
        String title,
        String content,
        double score
) {
}
