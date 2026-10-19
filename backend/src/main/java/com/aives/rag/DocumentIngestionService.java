package com.aives.rag;

import com.aives.config.AppProperties;
import com.aives.embedding.EmbeddingService;
import com.aives.knowledge.VectorLiteral;
import com.aives.rag.CourseDocumentParser.ParsedDocument;
import com.aives.rag.TextChunker.Chunk;
import com.aives.web.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

/**
 * Stores uploaded course documents and turns them into searchable knowledge chunks.
 *
 * <p>The upload request only validates, de-duplicates and stores the file, then returns a PENDING document.
 * Parsing, chunking and embedding run on a background executor; chunks are written in one transaction, so a
 * failure leaves the document FAILED with a reason and no partial chunks.
 */
@Service
public class DocumentIngestionService {

    private static final Logger log = LoggerFactory.getLogger(DocumentIngestionService.class);
    private static final Set<String> EXTENSIONS = Set.of("pdf", "docx", "pptx");
    private static final int PREVIEW_CHUNKS = 5;
    private static final int PREVIEW_CHARS = 700;

    private final JdbcTemplate jdbc;
    private final CourseDocumentParser parser;
    private final EmbeddingService embeddings;
    private final TaskExecutor executor;
    private final TransactionTemplate transactions;
    private final Path directory;
    private final DataSize maxSize;

    public DocumentIngestionService(
            JdbcTemplate jdbc,
            CourseDocumentParser parser,
            EmbeddingService embeddings,
            AppProperties properties,
            @Qualifier("documentProcessingExecutor") TaskExecutor executor,
            TransactionTemplate transactions,
            @Value("${app.documents-max-size:25MB}") DataSize maxSize
    ) {
        this.jdbc = jdbc;
        this.parser = parser;
        this.embeddings = embeddings;
        this.executor = executor;
        this.transactions = transactions;
        this.directory = Path.of(properties.documentsDir()).toAbsolutePath().normalize();
        this.maxSize = maxSize;
    }

    public DocumentItem upload(String teacherId, String subjectId, String topic, MultipartFile file) {
        String original = file.getOriginalFilename() == null ? "document" : Path.of(file.getOriginalFilename()).getFileName().toString();
        String extension = extension(original);
        if (!EXTENSIONS.contains(extension)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Upload a PDF, DOCX, or PPTX file");
        }
        if (file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The file is empty");
        }
        if (file.getSize() > maxSize.toBytes()) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "The file is larger than " + maxSize.toMegabytes() + " MB");
        }

        UUID id = UUID.randomUUID();
        Path stored = directory.resolve(id + "." + extension);
        String hash;
        try {
            Files.createDirectories(directory);
            hash = copyWithHash(file, stored);
        } catch (IOException exception) {
            delete(stored);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not store the file");
        }

        Optional<String> duplicate = activeDuplicate(teacherId, subjectId, hash);
        if (duplicate.isPresent()) {
            delete(stored);
            throw new ApiException(HttpStatus.CONFLICT, "This file was already uploaded as \"" + duplicate.get() + "\"");
        }

        String cleanTopic = topic == null || topic.isBlank() ? topicOf(original) : topic.trim();
        try {
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
                    cleanTopic,
                    original,
                    file.getContentType() == null ? "" : file.getContentType(),
                    file.getSize(),
                    stored.toString(),
                    hash
            );
        } catch (DuplicateKeyException exception) {
            // Two identical uploads raced past the duplicate check.
            delete(stored);
            throw new ApiException(HttpStatus.CONFLICT, "This file was already uploaded");
        }
        schedule(id.toString());
        return document(teacherId, id.toString());
    }

    /** Re-queues documents interrupted by a restart. */
    @EventListener(ApplicationReadyEvent.class)
    public void resumeUnfinished() {
        List<String> ids = jdbc.query(
                "SELECT id::text FROM course_document WHERE extraction_status IN ('PENDING', 'PROCESSING') ORDER BY created_at",
                (rs, row) -> rs.getString(1)
        );
        if (!ids.isEmpty()) {
            log.info("Resuming {} unfinished document(s)", ids.size());
        }
        ids.forEach(this::schedule);
    }

    private void schedule(String documentId) {
        try {
            executor.execute(() -> process(documentId));
        } catch (TaskRejectedException exception) {
            fail(documentId, "The server is busy processing other documents. Upload this file again in a few minutes.");
        }
    }

    void process(String documentId) {
        List<StoredDocument> rows = jdbc.query(
                """
                SELECT course_id::text, original_name, storage_path FROM course_document
                WHERE id = ?::uuid AND extraction_status IN ('PENDING', 'PROCESSING')
                """,
                (rs, row) -> new StoredDocument(rs.getString(1), rs.getString(2), rs.getString(3)),
                documentId
        );
        if (rows.isEmpty()) {
            return;
        }
        StoredDocument stored = rows.getFirst();
        jdbc.update("UPDATE course_document SET extraction_status = 'PROCESSING' WHERE id = ?::uuid", documentId);
        try {
            Path path = Path.of(stored.storagePath());
            ParsedDocument parsed;
            try (InputStream input = Files.newInputStream(path)) {
                parsed = parser.parse(input);
            } catch (Exception exception) {
                throw new ExtractionFailure("Could not read text from this file. It may be corrupted or password protected.");
            }
            Optional<String> problem = ExtractionCheck.problem(extension(stored.name()), parsed.pageCount(), parsed.pages());
            if (problem.isPresent()) {
                throw new ExtractionFailure(problem.get());
            }
            List<Chunk> chunks = TextChunker.chunk(parsed.pages());
            if (chunks.isEmpty()) {
                throw new ExtractionFailure("The file did not contain any text.");
            }
            // Embed everything before touching the database so the write below is short and all-or-nothing.
            List<String> vectors = new ArrayList<>(chunks.size());
            for (Chunk chunk : chunks) {
                vectors.add(VectorLiteral.format(embeddings.embed(stored.name() + "\n" + chunk.text())));
            }
            transactions.executeWithoutResult(status -> {
                String topic = jdbc.queryForObject(
                        "SELECT topic FROM course_document WHERE id = ?::uuid", String.class, documentId);
                for (int i = 0; i < chunks.size(); i++) {
                    Chunk chunk = chunks.get(i);
                    jdbc.update(
                            """
                            INSERT INTO knowledge_chunk
                                (id, course_id, document_id, topic, title, source_label, chunk_index, content, embedding)
                            VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?, ?, ?, ?, ?::vector)
                            """,
                            UUID.randomUUID().toString(),
                            stored.courseId(),
                            documentId,
                            topic,
                            stored.name(),
                            chunk.label(),
                            chunk.index(),
                            chunk.text(),
                            vectors.get(i)
                    );
                }
                jdbc.update(
                        """
                        UPDATE course_document
                        SET extraction_status = 'DONE', extraction_error = NULL, page_count = ?, processed_at = ?
                        WHERE id = ?::uuid
                        """,
                        parsed.pageCount() != null ? parsed.pageCount() : parsed.pages().size(),
                        Timestamp.from(Instant.now()),
                        documentId
                );
            });
            log.info("Document {} ({}) processed into {} chunks", documentId, stored.name(), chunks.size());
        } catch (ExtractionFailure exception) {
            fail(documentId, exception.getMessage());
        } catch (Exception exception) {
            log.error("Document {} ({}) failed to process", documentId, stored.name(), exception);
            fail(documentId, "Processing failed unexpectedly. Try uploading the file again.");
        }
    }

    private void fail(String documentId, String reason) {
        log.warn("Document {} failed: {}", documentId, reason);
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

    @Transactional
    public void delete(String teacherId, String documentId) {
        List<String> paths = jdbc.query(
                """
                SELECT storage_path FROM course_document
                WHERE id = ?::uuid AND uploaded_by = ?::uuid
                """,
                (rs, row) -> rs.getString(1),
                documentId,
                teacherId
        );
        if (paths.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Document not found");
        }
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
        delete(Path.of(paths.getFirst()));
    }

    @Transactional
    public DocumentItem updateTopic(String teacherId, String documentId, String topic) {
        if (topic == null || topic.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Topic is required");
        }
        String clean = topic.trim();
        int updated = jdbc.update(
                "UPDATE course_document SET topic = ? WHERE id = ?::uuid AND uploaded_by = ?::uuid",
                clean,
                documentId,
                teacherId
        );
        if (updated == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Document not found");
        }
        jdbc.update("UPDATE knowledge_chunk SET topic = ? WHERE document_id = ?::uuid", clean, documentId);
        return document(teacherId, documentId);
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

    public DocumentItem document(String teacherId, String documentId) {
        List<DocumentItem> rows = jdbc.query(
                DOCUMENT_SELECT + " WHERE d.id = ?::uuid AND d.uploaded_by = ?::uuid GROUP BY d.id",
                (rs, row) -> documentItem(rs),
                documentId,
                teacherId
        );
        if (rows.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Document not found");
        }
        return rows.getFirst();
    }

    /** The first extracted chunks, so the teacher can check what the AI will read. */
    public DocumentPreview preview(String teacherId, String documentId) {
        DocumentItem document = document(teacherId, documentId);
        List<PreviewChunk> chunks = jdbc.query(
                """
                SELECT source_label, content FROM knowledge_chunk
                WHERE document_id = ?::uuid
                ORDER BY chunk_index
                LIMIT ?
                """,
                (rs, row) -> {
                    String content = rs.getString(2);
                    boolean truncated = content.length() > PREVIEW_CHARS;
                    return new PreviewChunk(
                            rs.getString(1),
                            truncated ? content.substring(0, PREVIEW_CHARS) + "…" : content,
                            truncated
                    );
                },
                documentId,
                PREVIEW_CHUNKS
        );
        return new DocumentPreview(document, chunks);
    }

    public List<VivaQuestionGenerator.Passage> retrieve(String teacherId, String subjectId, String topic, int limit) {
        float[] vector = embeddings.embed(topic);
        String literal = VectorLiteral.format(vector);
        return jdbc.query(
                """
                SELECT c.title, c.source_label, c.content
                FROM knowledge_chunk c
                JOIN course_document d ON d.id = c.document_id
                WHERE d.uploaded_by = ?::uuid AND d.course_id = ?::uuid AND d.extraction_status = 'DONE'
                ORDER BY c.embedding <=> ?::vector
                LIMIT ?
                """,
                (rs, row) -> new VivaQuestionGenerator.Passage(
                        rs.getString("title") + ", " + rs.getString("source_label"),
                        rs.getString("content")
                ),
                teacherId,
                subjectId,
                literal,
                limit
        );
    }

    /** Course materials for the viva grader, without restricting to one uploader. */
    public List<VivaQuestionGenerator.Passage> retrieveForCourse(String courseId, String query, int limit) {
        if (courseId == null || courseId.isBlank() || query == null || query.isBlank() || limit <= 0) {
            return List.of();
        }
        float[] vector = embeddings.embed(query);
        String literal = VectorLiteral.format(vector);
        return jdbc.query(
                """
                SELECT c.title, c.source_label, c.content
                FROM knowledge_chunk c
                JOIN course_document d ON d.id = c.document_id
                WHERE d.course_id = ?::uuid AND d.extraction_status = 'DONE'
                ORDER BY c.embedding <=> ?::vector
                LIMIT ?
                """,
                (rs, row) -> new VivaQuestionGenerator.Passage(
                        rs.getString("title") + ", " + rs.getString("source_label"),
                        rs.getString("content")
                ),
                courseId,
                literal,
                limit
        );
    }

    private Optional<String> activeDuplicate(String teacherId, String subjectId, String hash) {
        List<String> names = jdbc.query(
                """
                SELECT original_name FROM course_document
                WHERE uploaded_by = ?::uuid AND course_id = ?::uuid AND content_hash = ?
                  AND extraction_status <> 'FAILED'
                """,
                (rs, row) -> rs.getString(1),
                teacherId,
                subjectId,
                hash
        );
        return names.stream().findFirst();
    }

    private static String copyWithHash(MultipartFile file, Path target) throws IOException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
        try (InputStream input = new DigestInputStream(file.getInputStream(), digest)) {
            Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private static final String DOCUMENT_SELECT = """
            SELECT d.id::text, d.original_name, d.topic, d.extraction_status, d.extraction_error,
                   d.size_bytes, d.page_count, count(c.id), d.created_at
            FROM course_document d
            LEFT JOIN knowledge_chunk c ON c.document_id = d.id
            """;

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

    private static String topicOf(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }

    private static String extension(String name) {
        int dot = name.lastIndexOf('.');
        if (dot < 0) {
            return "";
        }
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static void delete(Path stored) {
        try {
            Files.deleteIfExists(stored);
        } catch (IOException ignored) {
            // The rejected upload is left for a later cleanup if the disk is locked.
        }
    }

    private record StoredDocument(String courseId, String name, String storagePath) {
    }

    private static final class ExtractionFailure extends RuntimeException {
        ExtractionFailure(String message) {
            super(message);
        }
    }

    /**
     * @param status PENDING, PROCESSING, DONE or FAILED
     * @param error  why processing failed, for FAILED documents
     */
    public record DocumentItem(
            String id,
            String name,
            String topic,
            String status,
            String error,
            long sizeBytes,
            Integer pageCount,
            int chunks,
            Instant createdAt
    ) {
    }

    public record PreviewChunk(String label, String text, boolean truncated) {
    }

    public record DocumentPreview(DocumentItem document, List<PreviewChunk> chunks) {
    }
}
