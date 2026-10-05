package com.aives.rag;

import com.aives.config.AppProperties;
import com.aives.embedding.EmbeddingService;
import com.aives.knowledge.VectorLiteral;
import com.aives.rag.PageSplit.Page;
import com.aives.rag.TextChunker.Chunk;
import com.aives.web.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DocumentIngestionService {

    private static final Set<String> EXTENSIONS = Set.of("pdf", "docx", "pptx");

    private final JdbcTemplate jdbc;
    private final CourseDocumentParser parser;
    private final EmbeddingService embeddings;
    private final Path directory;

    public DocumentIngestionService(
            JdbcTemplate jdbc,
            CourseDocumentParser parser,
            EmbeddingService embeddings,
            AppProperties properties
    ) {
        this.jdbc = jdbc;
        this.parser = parser;
        this.embeddings = embeddings;
        this.directory = Path.of(properties.documentsDir()).toAbsolutePath().normalize();
    }

    public IngestedDocument ingest(String teacherId, String subjectId, MultipartFile file) {
        String original = file.getOriginalFilename() == null ? "document" : Path.of(file.getOriginalFilename()).getFileName().toString();
        String extension = extension(original);
        if (!EXTENSIONS.contains(extension)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Upload a PDF, DOCX, or PPTX file");
        }
        if (file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The file is empty");
        }
        UUID id = UUID.randomUUID();
        Path stored = directory.resolve(id + "." + extension);
        try {
            Files.createDirectories(directory);
            file.transferTo(stored);
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not store the file");
        }
        List<Page> pages;
        try (InputStream input = Files.newInputStream(stored)) {
            pages = parser.parse(input);
        } catch (Exception exception) {
            delete(stored);
            throw new ApiException(HttpStatus.BAD_REQUEST, "Could not read text from that file");
        }
        List<Chunk> chunks = TextChunker.chunk(pages);
        if (chunks.isEmpty()) {
            delete(stored);
            throw new ApiException(HttpStatus.BAD_REQUEST, "The file did not contain any text");
        }
        jdbc.update(
                """
                INSERT INTO course_document
                    (id, course_id, uploaded_by, topic, original_name, content_type, size_bytes, storage_path, extraction_status)
                VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?, ?, ?, ?, 'DONE')
                """,
                id.toString(),
                subjectId,
                teacherId,
                topicOf(original),
                original,
                file.getContentType() == null ? "" : file.getContentType(),
                file.getSize(),
                stored.toString()
        );
        for (Chunk chunk : chunks) {
            float[] vector = embeddings.embed(original + "\n" + chunk.text());
            jdbc.update(
                    """
                    INSERT INTO knowledge_chunk
                        (id, course_id, document_id, topic, title, source_label, chunk_index, content, embedding)
                    VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?, ?, ?, ?, ?::vector)
                    """,
                    UUID.randomUUID().toString(),
                    subjectId,
                    id.toString(),
                    topicOf(original),
                    original,
                    chunk.label(),
                    chunk.index(),
                    chunk.text(),
                    VectorLiteral.format(vector)
            );
        }
        return new IngestedDocument(id.toString(), original, chunks.size());
    }

    public List<IngestedDocument> list(String teacherId, String subjectId) {
        return jdbc.query(
                """
                SELECT d.id::text, d.original_name, count(c.id)
                FROM course_document d
                LEFT JOIN knowledge_chunk c ON c.document_id = d.id
                WHERE d.uploaded_by = ?::uuid AND d.course_id = ?::uuid
                GROUP BY d.id, d.original_name, d.created_at
                ORDER BY d.created_at DESC
                """,
                (rs, row) -> new IngestedDocument(rs.getString(1), rs.getString(2), rs.getInt(3)),
                teacherId,
                subjectId
        );
    }

    public List<VivaQuestionGenerator.Passage> retrieve(String teacherId, String subjectId, String topic, int limit) {
        float[] vector = embeddings.embed(topic);
        String literal = VectorLiteral.format(vector);
        return jdbc.query(
                """
                SELECT c.title, c.source_label, c.content
                FROM knowledge_chunk c
                JOIN course_document d ON d.id = c.document_id
                WHERE d.uploaded_by = ?::uuid AND d.course_id = ?::uuid
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

    public record IngestedDocument(String id, String name, int chunks) {
    }
}
