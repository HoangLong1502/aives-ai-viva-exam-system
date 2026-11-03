package com.aives.knowledge.model;

import java.time.Instant;
import java.util.UUID;

public record StoredKnowledge(
        UUID id,
        String title,
        String content,
        int dimensions,
        Instant createdAt
) {
}
