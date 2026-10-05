package com.aives.knowledge;

import com.aives.embedding.EmbeddingService;
import com.aives.web.ApiException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class KnowledgeService {

    private final KnowledgeRepository knowledge;
    private final EmbeddingService embeddings;

    public KnowledgeService(KnowledgeRepository knowledge, EmbeddingService embeddings) {
        this.knowledge = knowledge;
        this.embeddings = embeddings;
    }

    public StoredKnowledge create(UUID courseId, String title, String content) {
        String cleanTitle = title.trim();
        String cleanContent = content.trim();
        float[] embedding = embeddings.embed(cleanTitle + "\n" + cleanContent);
        return knowledge.insert(courseId, cleanTitle, cleanContent, embedding);
    }

    public List<StoredKnowledge> list() {
        return knowledge.list();
    }

    public List<KnowledgeMatch> search(String query, int limit) {
        String cleanQuery = query == null ? "" : query.trim();
        if (cleanQuery.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Query must not be blank");
        }
        int boundedLimit = Math.max(1, Math.min(limit, 20));
        return knowledge.search(embeddings.embed(cleanQuery), boundedLimit);
    }
}
