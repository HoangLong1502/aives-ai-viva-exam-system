package com.aives.knowledge;

import java.util.List;
import java.util.UUID;

public interface KnowledgeRepository {

    StoredKnowledge insert(UUID courseId, String title, String content, float[] embedding);

    List<StoredKnowledge> list();

    List<KnowledgeMatch> search(float[] embedding, int limit);
}
