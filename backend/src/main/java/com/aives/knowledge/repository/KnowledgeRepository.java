package com.aives.knowledge.repository;

import com.aives.knowledge.model.KnowledgeMatch;
import com.aives.knowledge.model.StoredKnowledge;
import java.util.List;
import java.util.UUID;

public interface KnowledgeRepository {

    StoredKnowledge insert(UUID courseId, String title, String content, float[] embedding);

    List<StoredKnowledge> list();

    List<KnowledgeMatch> search(float[] embedding, int limit);
}
