package com.aives.rag.service;

import com.aives.rag.parser.CourseDocumentParser;
import com.aives.rag.repository.DocumentRepository;
import com.aives.rag.util.ExtractionCheck;
import com.aives.rag.util.TextChunker;
import com.aives.config.AppProperties;
import com.aives.embedding.EmbeddingService;
import com.aives.knowledge.util.VectorLiteral;
import com.aives.rag.parser.CourseDocumentParser.ParsedDocument;
import com.aives.rag.repository.DocumentRepository.StoredDocument;
import com.aives.rag.util.TextChunker.Chunk;
import com.aives.web.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
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

    private final DocumentRepository documents;
    private final CourseDocumentParser parser;
    private final EmbeddingService embeddings;
    private final TaskExecutor executor;
    private final TransactionTemplate transactions;
    private final Path directory;
    private final DataSize maxSize;

    public DocumentIngestionService(
            DocumentRepository documents,
            CourseDocumentParser parser,
            EmbeddingService embeddings,
            AppProperties properties,
            @Qualifier("documentProcessingExecutor") TaskExecutor executor,
            TransactionTemplate transactions,
            @Value("${app.documents-max-size:25MB}") DataSize maxSize
    ) {
        this.documents = documents;
        this.parser = parser;
        this.embeddings = embeddings;
        this.executor = executor;
        this.transactions = transactions;
        this.directory = Path.of(properties.documentsDir()).toAbsolutePath().normalize();
        this.maxSize = maxSize;
        log.info("Course documents are stored in {}", directory);
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

        if (!hasExpectedSignature(stored, extension)) {
            delete(stored);
            throw new ApiException(HttpStatus.BAD_REQUEST, "The file content does not match its ." + extension + " extension");
        }

        Optional<String> duplicate = documents.activeDuplicateName(teacherId, subjectId, hash);
        if (duplicate.isPresent()) {
            delete(stored);
            throw new ApiException(HttpStatus.CONFLICT, "This file was already uploaded as \"" + duplicate.get() + "\"");
        }

        String cleanTopic = topic == null || topic.isBlank() ? topicOf(original) : topic.trim();
        try {
            documents.insert(
                    id,
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
        } catch (RuntimeException exception) {
            // Do not leave an orphan file behind when the row could not be written.
            delete(stored);
            throw exception;
        }
        schedule(id.toString());
        return document(teacherId, id.toString());
    }

    /** Re-queues documents interrupted by a restart. */
    @EventListener(ApplicationReadyEvent.class)
    public void resumeUnfinished() {
        List<String> ids = documents.unfinishedIds();
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
        Optional<StoredDocument> found = documents.findUnfinished(documentId);
        if (found.isEmpty()) {
            return;
        }
        StoredDocument stored = found.get();
        documents.markProcessing(documentId);
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
                String topic = documents.topicOf(documentId);
                for (int i = 0; i < chunks.size(); i++) {
                    Chunk chunk = chunks.get(i);
                    documents.insertChunk(
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
                documents.markDone(
                        documentId,
                        parsed.pageCount() != null ? parsed.pageCount() : parsed.pages().size()
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
        documents.markFailed(documentId, reason);
        documents.storagePathOf(documentId).ifPresent(path -> delete(Path.of(path)));
    }

    public String subjectIdOf(String teacherId, String documentId) {
        return documents.subjectIdOf(teacherId, documentId);
    }

    @Transactional
    public void delete(String teacherId, String documentId) {
        String path = documents.storagePathOf(teacherId, documentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document not found"));
        documents.deleteWithChunks(teacherId, documentId);
        delete(Path.of(path));
    }

    @Transactional
    public DocumentItem updateTopic(String teacherId, String documentId, String topic) {
        if (topic == null || topic.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Topic is required");
        }
        if (!documents.updateTopic(teacherId, documentId, topic.trim())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Document not found");
        }
        return document(teacherId, documentId);
    }

    public List<DocumentItem> list(String teacherId, String subjectId) {
        return documents.list(teacherId, subjectId);
    }

    public DocumentItem document(String teacherId, String documentId) {
        return documents.find(teacherId, documentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document not found"));
    }

    /** The first extracted chunks, so the teacher can check what the AI will read. */
    public DocumentPreview preview(String teacherId, String documentId) {
        DocumentItem document = document(teacherId, documentId);
        List<PreviewChunk> chunks = documents.firstChunks(documentId, PREVIEW_CHUNKS).stream()
                .map(chunk -> {
                    boolean truncated = chunk.content().length() > PREVIEW_CHARS;
                    return new PreviewChunk(
                            chunk.label(),
                            truncated ? chunk.content().substring(0, PREVIEW_CHARS) + "…" : chunk.content(),
                            truncated
                    );
                })
                .toList();
        return new DocumentPreview(document, chunks);
    }

    public List<VivaQuestionGenerator.Passage> retrieve(String teacherId, String subjectId, String topic, int limit) {
        String literal = VectorLiteral.format(embeddings.embed(topic));
        return documents.nearestForTeacher(teacherId, subjectId, literal, limit);
    }

    /** Course materials for the viva grader, without restricting to one uploader. */
    public List<VivaQuestionGenerator.Passage> retrieveForCourse(String courseId, String query, int limit) {
        if (courseId == null || courseId.isBlank() || query == null || query.isBlank() || limit <= 0) {
            return List.of();
        }
        String literal = VectorLiteral.format(embeddings.embed(query));
        return documents.nearestForCourse(courseId, literal, limit);
    }

    /** PDF files start with "%PDF-"; DOCX and PPTX are ZIP containers starting with "PK". */
    private static boolean hasExpectedSignature(Path file, String extension) {
        byte[] expected = "pdf".equals(extension)
                ? new byte[] {'%', 'P', 'D', 'F', '-'}
                : new byte[] {'P', 'K', 3, 4};
        try (InputStream input = Files.newInputStream(file)) {
            return java.util.Arrays.equals(input.readNBytes(expected.length), expected);
        } catch (IOException exception) {
            return false;
        }
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
