package com.aives.teaching;

import com.aives.rag.DocumentIngestionService;
import com.aives.rag.DocumentIngestionService.IngestedDocument;
import com.aives.rag.GeneratedQuestionParser.Draft;
import com.aives.rag.VivaQuestionGenerator;
import com.aives.teaching.DeskRecords.QuestionItem;
import com.aives.teaching.DeskRecords.RubricCriterionItem;
import com.aives.teaching.DeskRecords.RubricDetailItem;
import com.aives.teaching.DeskRecords.RubricItem;
import com.aives.teaching.DeskRecords.SubjectItem;
import com.aives.user.PublicUser;
import com.aives.web.ApiException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class TeachingService {

    private static final Set<String> BLOOM = Set.of("REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE");
    private static final Set<String> FORMATS = Set.of("MULTIPLE_CHOICE", "ORAL");

    private final JdbcDeskRepository desk;
    private final DocumentIngestionService ingestion;
    private final VivaQuestionGenerator generator;

    public TeachingService(
            JdbcDeskRepository desk,
            DocumentIngestionService ingestion,
            VivaQuestionGenerator generator
    ) {
        this.desk = desk;
        this.ingestion = ingestion;
        this.generator = generator;
    }

    public List<SubjectItem> mySubjects(PublicUser teacher) {
        return desk.subjectsForTeacher(teacher.id());
    }

    public SubjectItem createSubject(PublicUser teacher, String code, String name) {
        String trimmedCode = code.trim();
        String trimmedName = name.trim();
        if (trimmedCode.isEmpty() || trimmedName.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Subject code and name are required");
        }
        UUID id = UUID.randomUUID();
        try {
            desk.insertSubject(id, trimmedCode, trimmedName, teacher.id());
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "A subject with that code already exists");
        }
        desk.assignTeacher(id.toString(), teacher.id());
        return new SubjectItem(id.toString(), trimmedCode, trimmedName, List.of(teacher.id()));
    }

    public List<IngestedDocument> documents(PublicUser teacher, String subjectId) {
        requireSubject(teacher.id(), subjectId);
        return ingestion.list(teacher.id(), subjectId);
    }

    public IngestedDocument upload(PublicUser teacher, String subjectId, MultipartFile file) {
        requireSubject(teacher.id(), subjectId);
        return ingestion.ingest(teacher.id(), subjectId, file);
    }

    public List<RubricItem> rubrics(PublicUser teacher) {
        return desk.rubricsForTeacher(teacher.id());
    }

    public RubricDetailItem rubric(PublicUser teacher, String rubricId) {
        if (!desk.teacherOwnsRubric(teacher.id(), rubricId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Rubric not found");
        }
        RubricDetailItem detail = desk.rubricDetail(rubricId);
        if (detail == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Rubric not found");
        }
        return detail;
    }

    public RubricDetailItem updateRubric(
            PublicUser teacher,
            String rubricId,
            String name,
            String description,
            List<RubricCriterionItem> criteria
    ) {
        if (!desk.teacherOwnsRubric(teacher.id(), rubricId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Rubric not found");
        }
        String trimmedName = name == null ? "" : name.trim();
        if (trimmedName.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Rubric name is required");
        }
        if (criteria == null || criteria.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "At least one criterion is required");
        }
        List<RubricCriterionItem> normalized = new ArrayList<>();
        int order = 0;
        for (RubricCriterionItem criterion : criteria) {
            String criterionName = criterion.name() == null ? "" : criterion.name().trim();
            if (criterionName.isEmpty()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Each criterion needs a name");
            }
            if (criterion.maxPoints() <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Each criterion needs a positive max score");
            }
            String id = criterion.id() == null || criterion.id().isBlank()
                    ? UUID.randomUUID().toString()
                    : criterion.id();
            normalized.add(new RubricCriterionItem(
                    id,
                    criterionName,
                    criterion.description() == null ? "" : criterion.description().trim(),
                    criterion.maxPoints(),
                    order++
            ));
        }
        desk.updateRubric(rubricId, trimmedName, description, normalized);
        return rubric(teacher, rubricId);
    }

    public List<QuestionItem> questions(String status) {
        return desk.questions(status);
    }

    public QuestionItem create(
            PublicUser teacher,
            String subjectId,
            String topic,
            String prompt,
            String bloom,
            String rubricId
    ) {
        requireSubject(teacher.id(), subjectId);
        return save(teacher.id(), subjectId, topic, prompt, bloom, rubricId, "APPROVED", "MANUAL", null, null);
    }

    public List<QuestionItem> importLines(
            PublicUser teacher,
            String subjectId,
            String topic,
            String bloom,
            String rubricId,
            String text
    ) {
        requireSubject(teacher.id(), subjectId);
        requireBloom(bloom);
        List<QuestionItem> created = new ArrayList<>();
        for (String line : text.split("\\R")) {
            String prompt = line.trim();
            if (prompt.isEmpty()) {
                continue;
            }
            created.add(save(teacher.id(), subjectId, topic, prompt, bloom, rubricId, "APPROVED", "IMPORT", null, null));
        }
        if (created.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Paste at least one question");
        }
        return created;
    }

    public List<QuestionItem> generate(
            PublicUser teacher,
            String subjectId,
            String topic,
            String bloom,
            String rubricId,
            int count
    ) {
        requireSubject(teacher.id(), subjectId);
        requireBloom(bloom);
        int bounded = Math.max(1, Math.min(count, 10));
        List<VivaQuestionGenerator.Passage> passages = ingestion.retrieve(
                teacher.id(),
                subjectId,
                topic,
                Math.max(bounded * 2, 6)
        );
        if (passages.isEmpty()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Upload a PDF, DOCX, or PPTX for this subject before generating questions."
            );
        }
        requireRubric(rubricId, subjectId);
        List<Draft> drafts = generator.generate(topic, bloom, bounded, passages);
        UUID generationId = UUID.randomUUID();
        desk.insertGenerationRequest(
                generationId,
                subjectId,
                teacher.id(),
                topic.trim(),
                bloom,
                bounded,
                generator.modelName()
        );
        List<QuestionItem> created = new ArrayList<>();
        for (Draft draft : drafts) {
            created.add(save(
                    teacher.id(),
                    subjectId,
                    topic,
                    draft.prompt(),
                    bloom,
                    rubricId,
                    "PENDING_REVIEW",
                    "AI",
                    draft.source(),
                    generationId.toString()
            ));
        }
        return created;
    }

    public QuestionItem review(
            PublicUser reviewer,
            String id,
            String prompt,
            String bloom,
            String status,
            String topic
    ) {
        QuestionItem current = desk.question(id);
        if (current == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Question not found");
        }
        requireSubject(reviewer.id(), current.subjectId());
        requireBloom(bloom);
        if (!Set.of("PENDING_REVIEW", "APPROVED", "REJECTED").contains(status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown question status");
        }
        String nextTopic = topic == null || topic.isBlank() ? current.topic() : topic.trim();
        if (nextTopic.isBlank() || prompt == null || prompt.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Topic and prompt are required");
        }
        desk.updateQuestion(id, nextTopic, prompt.trim(), bloom, status, reviewer.id());
        return desk.question(id);
    }

    public void deleteQuestion(PublicUser teacher, String id) {
        QuestionItem current = desk.question(id);
        if (current == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Question not found");
        }
        requireSubject(teacher.id(), current.subjectId());
        desk.deleteQuestion(id);
    }

    public void startExam(
            PublicUser teacher,
            String title,
            String format,
            String subjectId,
            List<String> questionIds
    ) {
        requireSubject(teacher.id(), subjectId);
        if (!FORMATS.contains(format)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Format must be multiple choice or oral");
        }
        UUID examId = UUID.randomUUID();
        desk.insertExam(examId, title.trim(), format, teacher.id(), subjectId);
        for (String questionId : questionIds) {
            QuestionItem question = desk.question(questionId);
            if (question == null || !"APPROVED".equals(question.status())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Only approved questions can start a test");
            }
            desk.linkQuestion(examId.toString(), questionId);
        }
    }

    public List<DeskRecords.AttemptItem> scores(PublicUser teacher) {
        return desk.attemptsForTeacher(teacher.id());
    }

    public void score(PublicUser teacher, String attemptId, int score) {
        if (score < 0 || score > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Score must be between 0 and 100");
        }
        desk.setScore(attemptId, teacher.id(), score);
    }

    private QuestionItem save(
            String authorId,
            String subjectId,
            String topic,
            String prompt,
            String bloom,
            String rubricId,
            String status,
            String source,
            String sourceRef,
            String generationId
    ) {
        if (prompt == null || prompt.isBlank() || topic == null || topic.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Topic and prompt are required");
        }
        requireBloom(bloom);
        requireRubric(rubricId, subjectId);
        UUID id = UUID.randomUUID();
        desk.insertQuestion(
                id,
                subjectId,
                topic.trim(),
                prompt.trim(),
                bloom,
                rubricId,
                status,
                source,
                authorId,
                sourceRef,
                generationId
        );
        return desk.question(id.toString());
    }

    private void requireSubject(String teacherId, String subjectId) {
        if (!desk.teacherOwnsSubject(teacherId, subjectId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You are not assigned to that subject");
        }
    }

    private void requireRubric(String rubricId, String subjectId) {
        if (!desk.rubricBelongsToCourse(rubricId, subjectId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "That rubric belongs to a different subject");
        }
    }

    private static void requireBloom(String bloom) {
        if (!BLOOM.contains(bloom)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Bloom level must be remember, understand, apply, or analyze");
        }
    }
}
