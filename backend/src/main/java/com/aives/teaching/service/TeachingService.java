package com.aives.teaching.service;

import com.aives.teaching.dto.DeskRecords;
import com.aives.teaching.grading.VivaTurnFlow;
import com.aives.teaching.repository.JdbcDeskRepository;
import com.aives.rag.service.DocumentIngestionService;
import com.aives.rag.service.DocumentIngestionService.DocumentItem;
import com.aives.rag.service.DocumentIngestionService.DocumentPreview;
import com.aives.rag.parser.GeneratedQuestionParser.Draft;
import com.aives.rag.service.RubricDraftGenerator;
import com.aives.rag.service.RubricDraftGenerator.RubricDraft;
import com.aives.rag.service.VivaQuestionGenerator;
import com.aives.teaching.dto.DeskRecords.ExamDetailItem;
import com.aives.teaching.dto.DeskRecords.ExamListItem;
import com.aives.teaching.dto.DeskRecords.QuestionItem;
import com.aives.teaching.dto.DeskRecords.RubricCriterionItem;
import com.aives.teaching.dto.DeskRecords.RubricDetailItem;
import com.aives.teaching.dto.DeskRecords.RubricItem;
import com.aives.teaching.dto.DeskRecords.SubjectItem;
import com.aives.user.dto.PublicUser;
import com.aives.web.ApiException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class TeachingService {

    private static final Set<String> BLOOM = Set.of("EASY", "MEDIUM", "HARD");
    private static final int DEFAULT_DURATION_MINUTES = 30;
    private static final int DEFAULT_ANSWER_TIME_LIMIT_SEC = 120;
    private static final Set<String> FORMATS = Set.of("MULTIPLE_CHOICE", "ORAL");
    private static final Set<String> EXAM_STATUSES = Set.of("IN_PROGRESS", "COMPLETED");

    private final JdbcDeskRepository desk;
    private final DocumentIngestionService ingestion;
    private final VivaQuestionGenerator generator;
    private final RubricDraftGenerator rubricDrafts;

    public TeachingService(
            JdbcDeskRepository desk,
            DocumentIngestionService ingestion,
            VivaQuestionGenerator generator,
            RubricDraftGenerator rubricDrafts
    ) {
        this.desk = desk;
        this.ingestion = ingestion;
        this.generator = generator;
        this.rubricDrafts = rubricDrafts;
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

    public List<DocumentItem> documents(PublicUser teacher, String subjectId) {
        requireSubject(teacher.id(), subjectId);
        return ingestion.list(teacher.id(), subjectId);
    }

    /** Stores the file and queues it for processing; poll {@link #document} for the result. */
    public DocumentItem upload(PublicUser teacher, String subjectId, String topic, MultipartFile file) {
        requireSubject(teacher.id(), subjectId);
        return ingestion.upload(teacher.id(), subjectId, topic, file);
    }

    public DocumentItem document(PublicUser teacher, String documentId) {
        requireDocument(teacher, documentId);
        return ingestion.document(teacher.id(), documentId);
    }

    public DocumentPreview previewDocument(PublicUser teacher, String documentId) {
        requireDocument(teacher, documentId);
        return ingestion.preview(teacher.id(), documentId);
    }

    public DocumentItem updateDocumentTopic(PublicUser teacher, String documentId, String topic) {
        requireDocument(teacher, documentId);
        return ingestion.updateTopic(teacher.id(), documentId, topic);
    }

    public void deleteDocument(PublicUser teacher, String documentId) {
        requireDocument(teacher, documentId);
        ingestion.delete(teacher.id(), documentId);
    }

    private void requireDocument(PublicUser teacher, String documentId) {
        String subjectId = ingestion.subjectIdOf(teacher.id(), documentId);
        if (subjectId == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Document not found");
        }
        requireSubject(teacher.id(), subjectId);
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
        List<RubricCriterionItem> normalized = normalizeCriteria(criteria);
        desk.updateRubric(rubricId, trimmedName, description, normalized);
        return rubric(teacher, rubricId);
    }

    public RubricDetailItem createRubric(
            PublicUser teacher,
            String subjectId,
            String name,
            String description,
            List<RubricCriterionItem> criteria
    ) {
        requireSubject(teacher.id(), subjectId);
        String trimmedName = name == null ? "" : name.trim();
        if (trimmedName.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Rubric name is required");
        }
        List<RubricCriterionItem> normalized = normalizeCriteria(criteria);
        UUID id = UUID.randomUUID();
        desk.insertRubric(id, subjectId, teacher.id(), trimmedName, description, normalized);
        return rubric(teacher, id.toString());
    }

    /**
     * Asks the AI for a rubric built from the subject's uploaded material. Nothing is saved: the teacher
     * edits the draft and saves it through {@link #createRubric}.
     */
    public RubricDraft draftRubric(
            PublicUser teacher,
            String subjectId,
            String focus,
            Integer criteriaCount,
            Double totalPoints
    ) {
        requireSubject(teacher.id(), subjectId);
        int count = criteriaCount == null ? 4 : criteriaCount;
        if (count < 2 || count > 8) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "A rubric draft needs between 2 and 8 criteria");
        }
        double total = totalPoints == null ? 10 : totalPoints;
        if (total < count * 0.5 || total > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Total points must be between the criteria count / 2 and 100");
        }
        String subjectName = desk.subjectsForTeacher(teacher.id()).stream()
                .filter(subject -> subject.id().equals(subjectId))
                .map(subject -> subject.code() + " - " + subject.name())
                .findFirst()
                .orElse("");
        String query = focus == null || focus.isBlank() ? subjectName : focus.trim();
        List<VivaQuestionGenerator.Passage> passages = ingestion.retrieveForCourse(subjectId, query, 10);
        if (passages.isEmpty()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Upload a PDF, DOCX, or PPTX for this subject before drafting a rubric."
            );
        }
        return rubricDrafts.draft(subjectName, focus, count, total, passages);
    }

    public List<QuestionItem> questions(PublicUser teacher, String status) {
        return desk.questions(teacher.id(), status);
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
        return save(teacher.id(), subjectId, topic, prompt, bloom, rubricId, "APPROVED", "MANUAL", null, null, null, null);
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
            created.add(save(teacher.id(), subjectId, topic, prompt, bloom, rubricId, "APPROVED", "IMPORT", null, null, null, null));
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
                    generationId.toString(),
                    draft.expectedAnswer(),
                    draft.keyPoints()
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
            String topic,
            String expectedAnswer,
            String keyPoints
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
        String nextExpected = expectedAnswer == null ? current.expectedAnswer() : expectedAnswer.trim();
        String nextKeyPoints = keyPoints == null ? current.keyPoints() : keyPoints.trim();
        if (nextExpected != null && nextExpected.isBlank()) {
            nextExpected = null;
        }
        if (nextKeyPoints != null && nextKeyPoints.isBlank()) {
            nextKeyPoints = null;
        }
        desk.updateQuestion(
                id,
                nextTopic,
                prompt.trim(),
                bloom,
                status,
                reviewer.id(),
                nextExpected,
                nextKeyPoints
        );
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

    @Transactional
    public ExamListItem startExam(
            PublicUser teacher,
            String title,
            String format,
            String subjectId,
            List<String> questionIds,
            Integer durationMinutes,
            Integer maxFollowUps,
            Integer answerTimeLimitSec
    ) {
        requireSubject(teacher.id(), subjectId);
        int minutes = durationMinutes == null ? DEFAULT_DURATION_MINUTES : durationMinutes;
        if (minutes < 1 || minutes > 600) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Duration must be between 1 and 600 minutes");
        }
        int followUps = maxFollowUps == null ? VivaTurnFlow.DEFAULT_MAX_FOLLOW_UPS : maxFollowUps;
        if (followUps < 0 || followUps > 5) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Follow-up questions must be between 0 and 5");
        }
        int answerSeconds = answerTimeLimitSec == null ? DEFAULT_ANSWER_TIME_LIMIT_SEC : answerTimeLimitSec;
        if (answerSeconds != 0 && (answerSeconds < 15 || answerSeconds > 1800)) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Answer time must be 0 (no limit) or between 15 and 1800 seconds"
            );
        }
        if (title == null || title.isBlank() || title.trim().length() > 255) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Test title must be 1 to 255 characters");
        }
        if (!FORMATS.contains(format)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Format must be multiple choice or oral");
        }
        requireExamQuestions(subjectId, questionIds);
        UUID examId = UUID.randomUUID();
        desk.insertExam(examId, title.trim(), format, teacher.id(), subjectId, minutes, followUps, answerSeconds);
        desk.replaceExamQuestions(examId.toString(), questionIds);
        return requireExam(teacher, examId.toString());
    }

    public List<ExamListItem> exams(PublicUser teacher) {
        return desk.examsForTeacher(teacher.id());
    }

    public ExamDetailItem exam(PublicUser teacher, String examId) {
        ExamListItem current = requireExam(teacher, examId);
        return toDetail(current, desk.questionsOnExam(examId));
    }

    public ExamListItem renameExam(PublicUser teacher, String examId, String title) {
        requireExam(teacher, examId);
        String trimmed = title == null ? "" : title.trim();
        if (trimmed.isEmpty() || trimmed.length() > 255) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Test title must be 1 to 255 characters");
        }
        desk.renameExam(examId, teacher.id(), trimmed);
        return requireExam(teacher, examId);
    }

    public ExamListItem setExamStatus(PublicUser teacher, String examId, String status) {
        requireExam(teacher, examId);
        if (!EXAM_STATUSES.contains(status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Status must be in progress or completed");
        }
        desk.setExamStatus(examId, teacher.id(), status);
        return requireExam(teacher, examId);
    }

    @Transactional
    public ExamDetailItem replaceExamQuestions(PublicUser teacher, String examId, List<String> questionIds) {
        ExamListItem current = requireExam(teacher, examId);
        if (desk.attemptCount(examId) > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Students have already entered this test");
        }
        requireExamQuestions(current.subjectId(), questionIds);
        desk.replaceExamQuestions(examId, questionIds);
        return toDetail(requireExam(teacher, examId), desk.questionsOnExam(examId));
    }

    public void deleteExam(PublicUser teacher, String examId) {
        requireExam(teacher, examId);
        if (desk.attemptCount(examId) > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Students have already entered this test");
        }
        desk.deleteExam(examId);
    }

    public List<DeskRecords.AttemptItem> scores(PublicUser teacher) {
        return desk.attemptsForTeacher(teacher.id());
    }

    public void score(PublicUser teacher, String attemptId, int score) {
        if (score < 0 || score > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Score must be between 0 and 100");
        }
        if (desk.setScore(attemptId, teacher.id(), score) == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Attempt not found");
        }
    }

    private ExamListItem requireExam(PublicUser teacher, String examId) {
        ExamListItem current = desk.examForTeacher(examId, teacher.id());
        if (current == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Test not found");
        }
        requireSubject(teacher.id(), current.subjectId());
        return current;
    }

    private void requireExamQuestions(String subjectId, List<String> questionIds) {
        if (questionIds == null || questionIds.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Select at least one approved question");
        }
        for (String questionId : questionIds) {
            QuestionItem question = desk.question(questionId);
            if (question == null || !subjectId.equals(question.subjectId()) || !"APPROVED".equals(question.status())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Only approved questions from this subject can be used");
            }
        }
    }

    private static ExamDetailItem toDetail(ExamListItem exam, List<QuestionItem> questions) {
        return new ExamDetailItem(
                exam.id(),
                exam.title(),
                exam.format(),
                exam.status(),
                exam.subjectId(),
                exam.subjectName(),
                questions
        );
    }

    private static List<RubricCriterionItem> normalizeCriteria(List<RubricCriterionItem> criteria) {
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
        return normalized;
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
            String generationId,
            String expectedAnswer,
            String keyPoints
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
                generationId,
                blankToNull(expectedAnswer),
                blankToNull(keyPoints)
        );
        return desk.question(id.toString());
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
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
            throw new ApiException(HttpStatus.BAD_REQUEST, "Difficulty must be easy, medium, or hard");
        }
    }
}
