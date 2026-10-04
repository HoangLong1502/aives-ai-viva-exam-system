package com.aives.knowledge;

import com.aives.embedding.EmbeddingService;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcKnowledgeRepository implements KnowledgeRepository {

    private final JdbcTemplate jdbc;

    public JdbcKnowledgeRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public StoredKnowledge insert(UUID courseId, String title, String content, float[] embedding) {
        UUID id = UUID.randomUUID();
        jdbc.update(
                """
                INSERT INTO knowledge_chunk (id, course_id, topic, title, content, embedding)
                VALUES (?, ?, ?, ?, ?, ?::vector)
                """,
                id,
                courseId,
                title,
                title,
                content,
                VectorLiteral.format(embedding)
        );
        return new StoredKnowledge(id, title, content, EmbeddingService.DIMENSIONS, Instant.now());
    }

    @Override
    public List<StoredKnowledge> list() {
        return jdbc.query(
                """
                SELECT id, title, content, created_at
                FROM knowledge_chunk
                ORDER BY created_at DESC
                """,
                (rs, rowNum) -> new StoredKnowledge(
                        rs.getObject("id", UUID.class),
                        rs.getString("title"),
                        rs.getString("content"),
                        EmbeddingService.DIMENSIONS,
                        instant(rs.getTimestamp("created_at"))
                )
        );
    }

    @Override
    public List<KnowledgeMatch> search(float[] embedding, int limit) {
        String vector = VectorLiteral.format(embedding);
        return jdbc.query(
                """
                SELECT id, title, content, 1 - (embedding <=> ?::vector) AS score
                FROM knowledge_chunk
                ORDER BY embedding <=> ?::vector
                LIMIT ?
                """,
                (rs, rowNum) -> new KnowledgeMatch(
                        rs.getObject("id", UUID.class),
                        rs.getString("title"),
                        rs.getString("content"),
                        clamp(rs.getDouble("score"))
                ),
                vector,
                vector,
                limit
        );
    }

    private static Instant instant(Timestamp timestamp) {
        return timestamp == null ? Instant.now() : timestamp.toInstant();
    }

    private static double clamp(double score) {
        if (Double.isNaN(score)) {
            return 0;
        }
        return Math.max(0, Math.min(1, score));
    }
}
