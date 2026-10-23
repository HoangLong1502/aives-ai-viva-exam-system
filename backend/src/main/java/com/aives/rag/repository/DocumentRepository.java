package com.aives.rag.repository;

import com.aives.rag.service.VivaQuestionGenerator;
import com.aives.rag.service.DocumentIngestionService.DocumentItem;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** SQL for course documents and their knowledge chunks. */
@Repository
public class DocumentRepository {

    private static final String DOCUMENT_SELECT = """
            SELECT d.id::text, d.original_name, d.topic, d.extraction_status, d.extraction_error,
                   d.size_bytes, d.page_count, count(c.id), d.created_at
            FROM course_document d
            LEFT JOIN knowledge_chunk c ON c.document_id = d.id
            """;

    private final JdbcTemplate jdbc;

    public DocumentRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(
            UUID id,
            String subjectId,
            String teacherId,
            String topic,
            String originalName,
            String contentType,
            long sizeBytes,
            String storagePath,
            String hash
    ) {
        jdbc.update(
                """
                INSERT INTO course_document
                    (id, course_id, uploaded_by, topic, original_name, content_type, size_bytes, storage_path,
                     extraction_status, content_hash)
                VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?, ?, ?, ?, 'PENDING', ?)
                """,
                id.toString(),
                subjectId,
                teacherId,
                topic,
                originalName,
                contentType,
                sizeBytes,
                storagePath,
                hash
        );
    }

    public Optional<String> activeDuplicateName(String teacherId, String subjectId, String hash) {
        return jdbc.query(
                """
                SELECT original_name FROM course_document
                WHERE uploaded_by = ?::uuid AND course_id = ?::uuid AND content_hash = ?
                  AND extraction_status <> 'FAILED'
                """,
                (rs, row) -> rs.getString(1),
                teacherId,
                subjectId,
                hash
        ).stream().findFirst();
    }

    public List<String> unfinishedIds() {
        return jdbc.query(
                "SELECT id::text FROM course_document WHERE extraction_status IN ('PENDING', 'PROCESSING') ORDER BY created_at",
                (rs, row) -> rs.getString(1)
        );
    }

    public Optional<StoredDocument> findUnfinished(String documentId) {
        return jdbc.query(
                """
                SELECT course_id::text, original_name, storage_path FROM course_document
                WHERE id = ?::uuid AND extraction_status IN ('PENDING', 'PROCESSING')
                """,
                (rs, row) -> new StoredDocument(rs.getString(1), rs.getString(2), rs.getString(3)),
                documentId
        ).stream().findFirst();
    }

    public void markProcessing(String documentId) {
        jdbc.update("UPDATE course_document SET extraction_status = 'PROCESSING' WHERE id = ?::uuid", documentId);
    }

    public String topicOf(String documentId) {
        return jdbc.queryForObject("SELECT topic FROM course_document WHERE id = ?::uuid", String.class, documentId);
    }

    public void insertChunk(
            String courseId,
            String documentId,
            String topic,
            String title,
            String sourceLabel,
            int chunkIndex,
            String content,
            String vectorLiteral
    ) {
        jdbc.update(
                """
                INSERT INTO knowledge_chunk
                    (id, course_id, document_id, topic, title, source_label, chunk_index, content, embedding)
                VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?, ?, ?, ?, ?::vector)
                """,
                UUID.randomUUID().toString(),
                courseId,
                documentId,
                topic,
                title,
                sourceLabel,
                chunkIndex,
                content,
                vectorLiteral
        );
    }

    public void markDone(String documentId, int pageCount) {
        jdbc.update(
                """
                UPDATE course_document
                SET extraction_status = 'DONE', extraction_error = NULL, page_count = ?, processed_at = ?
                WHERE id = ?::uuid
                """,
                pageCount,
                Timestamp.from(Instant.now()),
                documentId
        );
    }

    public void markFailed(String documentId, String reason) {
        jdbc.update(
                """
                UPDATE course_document
                SET extraction_status = 'FAILED', extraction_error = ?, processed_at = ?
                WHERE id = ?::uuid
                """,
                reason,
                Timestamp.from(Instant.now()),
                documentId
        );
    }

    public String subjectIdOf(String teacherId, String documentId) {
        List<String> rows = jdbc.query(
                """
                SELECT course_id::text FROM course_document
                WHERE id = ?::uuid AND uploaded_by = ?::uuid
                """,
                (rs, row) -> rs.getString(1),
                documentId,
                teacherId
        );
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public Optional<String> storagePathOf(String teacherId, String documentId) {
        return jdbc.query(
                """
                SELECT storage_path FROM course_document
                WHERE id = ?::uuid AND uploaded_by = ?::uuid
                """,
                (rs, row) -> rs.getString(1),
                documentId,
                teacherId
        ).stream().findFirst();
    }

    public Optional<String> storagePathOf(String documentId) {
        return jdbc.query(
                "SELECT storage_path FROM course_document WHERE id = ?::uuid",
                (rs, row) -> rs.getString(1),
                documentId
        ).stream().findFirst();
    }

    /** Removes the document together with its chunks and the question links that point at them. */
    public void deleteWithChunks(String teacherId, String documentId) {
        jdbc.update(
                """
                DELETE FROM question_source_chunk
                WHERE chunk_id IN (SELECT id FROM knowledge_chunk WHERE document_id = ?::uuid)
                """,
                documentId
        );
        jdbc.update("DELETE FROM knowledge_chunk WHERE document_id = ?::uuid", documentId);
        jdbc.update(
                "DELETE FROM course_document WHERE id = ?::uuid AND uploaded_by = ?::uuid",
                documentId,
                teacherId
        );
    }

    /** Renames the topic of the document and its chunks; false when the teacher does not own it. */
    public boolean updateTopic(String teacherId, String documentId, String topic) {
        int updated = jdbc.update(
                "UPDATE course_document SET topic = ? WHERE id = ?::uuid AND uploaded_by = ?::uuid",
                topic,
                documentId,
                teacherId
        );
        if (updated == 0) {
            return false;
        }
        jdbc.update("UPDATE knowledge_chunk SET topic = ? WHERE document_id = ?::uuid", topic, documentId);
        return true;
    }

    public List<DocumentItem> list(String teacherId, String subjectId) {
        return jdbc.query(
                DOCUMENT_SELECT + """
                        WHERE d.uploaded_by = ?::uuid AND d.course_id = ?::uuid
                        GROUP BY d.id
                        ORDER BY d.created_at DESC
                        """,
                (rs, row) -> documentItem(rs),
                teacherId,
                subjectId
        );
    }

    public Optional<DocumentItem> find(String teacherId, String documentId) {
        return jdbc.query(
                DOCUMENT_SELECT + " WHERE d.id = ?::uuid AND d.uploaded_by = ?::uuid GROUP BY d.id",
                (rs, row) -> documentItem(rs),
                documentId,
                teacherId
        ).stream().findFirst();
    }

    public List<ChunkText> firstChunks(String documentId, int limit) {
        return jdbc.query(
                """
                SELECT source_label, content FROM knowledge_chunk
                WHERE document_id = ?::uuid
                ORDER BY chunk_index
                LIMIT ?
                """,
                (rs, row) -> new ChunkText(rs.getString(1), rs.getString(2)),
                documentId,
                limit
        );
    }

    public List<VivaQuestionGenerator.Passage> nearestForTeacher(
            String teacherId, String subjectId, String vectorLiteral, int limit) {
        return jdbc.query(
                """
                SELECT c.title, c.source_label, c.content
                FROM knowledge_chunk c
                JOIN course_document d ON d.id = c.document_id
                WHERE d.uploaded_by = ?::uuid AND d.course_id = ?::uuid AND d.extraction_status = 'DONE'
                ORDER BY c.embedding <=> ?::vector
                LIMIT ?
                """,
                (rs, row) -> passage(rs),
                teacherId,
                subjectId,
                vectorLiteral,
                limit
        );
    }

    public List<VivaQuestionGenerator.Passage> nearestForCourse(String courseId, String vectorLiteral, int limit) {
        return jdbc.query(
                """
                SELECT c.title, c.source_label, c.content
                FROM knowledge_chunk c
                JOIN course_document d ON d.id = c.document_id
                WHERE d.course_id = ?::uuid AND d.extraction_status = 'DONE'
                ORDER BY c.embedding <=> ?::vector
                LIMIT ?
                """,
                (rs, row) -> passage(rs),
                courseId,
                vectorLiteral,
                limit
        );
    }

    private static VivaQuestionGenerator.Passage passage(ResultSet rs) throws SQLException {
        return new VivaQuestionGenerator.Passage(
                rs.getString("title") + ", " + rs.getString("source_label"),
                rs.getString("content")
        );
    }

    private static DocumentItem documentItem(ResultSet rs) throws SQLException {
        return new DocumentItem(
                rs.getString(1),
                rs.getString(2),
                rs.getString(3),
                rs.getString(4),
                rs.getString(5),
                rs.getLong(6),
                (Integer) rs.getObject(7),
                rs.getInt(8),
                rs.getTimestamp(9).toInstant()
        );
    }

    public record StoredDocument(String courseId, String name, String storagePath) {
    }

    public record ChunkText(String label, String content) {
    }
}
