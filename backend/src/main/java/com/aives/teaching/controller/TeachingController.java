package com.aives.teaching.controller;

import com.aives.teaching.service.TeachingService;
import com.aives.rag.service.DocumentIngestionService.DocumentItem;
import com.aives.rag.service.DocumentIngestionService.DocumentPreview;
import com.aives.teaching.dto.DeskRecords.AttemptItem;
import com.aives.rag.service.RubricDraftGenerator.RubricDraft;
import com.aives.teaching.dto.DeskRecords.ExamDetailItem;
import com.aives.teaching.dto.DeskRecords.ExamListItem;
import com.aives.teaching.dto.DeskRecords.QuestionItem;
import com.aives.teaching.dto.DeskRecords.RubricCriterionItem;
import com.aives.teaching.dto.DeskRecords.RubricDetailItem;
import com.aives.teaching.dto.DeskRecords.RubricItem;
import com.aives.teaching.dto.DeskRecords.SubjectItem;
import com.aives.user.dto.PublicUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/teaching")
public class TeachingController {

    private final TeachingService teaching;

    public TeachingController(TeachingService teaching) {
        this.teaching = teaching;
    }

    @GetMapping("/subjects")
    public List<SubjectItem> subjects(@AuthenticationPrincipal PublicUser teacher) {
        return teaching.mySubjects(teacher);
    }

    @PostMapping("/subjects")
    public SubjectItem createSubject(
            @AuthenticationPrincipal PublicUser teacher,
            @Valid @RequestBody SubjectRequest request
    ) {
        return teaching.createSubject(teacher, request.code(), request.name());
    }

    @GetMapping("/rubrics")
    public List<RubricItem> rubrics(@AuthenticationPrincipal PublicUser teacher) {
        return teaching.rubrics(teacher);
    }

    @GetMapping("/rubrics/{id}")
    public RubricDetailItem rubric(
            @AuthenticationPrincipal PublicUser teacher,
            @PathVariable String id
    ) {
        return teaching.rubric(teacher, id);
    }

    @PutMapping("/rubrics/{id}")
    public RubricDetailItem updateRubric(
            @AuthenticationPrincipal PublicUser teacher,
            @PathVariable String id,
            @Valid @RequestBody UpdateRubricRequest request
    ) {
        return teaching.updateRubric(teacher, id, request.name(), request.description(), request.criteria());
    }

    @GetMapping("/documents")
    public List<DocumentItem> documents(
            @AuthenticationPrincipal PublicUser teacher,
            @RequestParam String subjectId
    ) {
        return teaching.documents(teacher, subjectId);
    }

    /** Accepts the file and processes it in the background; the returned document starts as PENDING. */
    @PostMapping(value = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.ACCEPTED)
    public DocumentItem upload(
            @AuthenticationPrincipal PublicUser teacher,
            @RequestParam String subjectId,
            @RequestParam(required = false) String topic,
            @RequestParam MultipartFile file
    ) {
        return teaching.upload(teacher, subjectId, topic, file);
    }

    @GetMapping("/documents/{id}")
    public DocumentItem document(
            @AuthenticationPrincipal PublicUser teacher,
            @PathVariable String id
    ) {
        return teaching.document(teacher, id);
    }

    @GetMapping("/documents/{id}/preview")
    public DocumentPreview previewDocument(
            @AuthenticationPrincipal PublicUser teacher,
            @PathVariable String id
    ) {
        return teaching.previewDocument(teacher, id);
    }

    @PatchMapping("/documents/{id}")
    public DocumentItem updateDocument(
            @AuthenticationPrincipal PublicUser teacher,
            @PathVariable String id,
            @Valid @RequestBody DocumentTopicRequest request
    ) {
        return teaching.updateDocumentTopic(teacher, id, request.topic());
    }

    @DeleteMapping("/documents/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDocument(
            @AuthenticationPrincipal PublicUser teacher,
            @PathVariable String id
    ) {
        teaching.deleteDocument(teacher, id);
    }

    /** An AI-suggested rubric for the subject; it is not saved until the teacher creates it. */
    @PostMapping("/rubrics/draft")
    public RubricDraft draftRubric(
            @AuthenticationPrincipal PublicUser teacher,
            @Valid @RequestBody RubricDraftRequest request
    ) {
        return teaching.draftRubric(
                teacher,
                request.subjectId(),
                request.focus(),
                request.criteriaCount(),
                request.totalPoints()
        );
    }

    @PostMapping("/rubrics")
    public RubricDetailItem createRubric(
            @AuthenticationPrincipal PublicUser teacher,
            @Valid @RequestBody CreateRubricRequest request
    ) {
        return teaching.createRubric(
                teacher,
                request.subjectId(),
                request.name(),
                request.description(),
                request.criteria()
        );
    }

    @GetMapping("/questions")
    public List<QuestionItem> questions(
            @AuthenticationPrincipal PublicUser teacher,
            @RequestParam(required = false) String status
    ) {
        return teaching.questions(teacher, status);
    }

    @PostMapping("/questions")
    public QuestionItem create(
            @AuthenticationPrincipal PublicUser teacher,
            @Valid @RequestBody QuestionRequest request
    ) {
        return teaching.create(
                teacher,
                request.subjectId(),
                request.topic(),
                request.prompt(),
                request.bloom(),
                request.rubricId()
        );
    }

    @PostMapping("/questions/import")
    public List<QuestionItem> importQuestions(
            @AuthenticationPrincipal PublicUser teacher,
            @Valid @RequestBody ImportRequest request
    ) {
        return teaching.importLines(
                teacher,
                request.subjectId(),
                request.topic(),
                request.bloom(),
                request.rubricId(),
                request.text()
        );
    }

    @PostMapping("/questions/generate")
    public List<QuestionItem> generate(
            @AuthenticationPrincipal PublicUser teacher,
            @Valid @RequestBody GenerateRequest request
    ) {
        return teaching.generate(
                teacher,
                request.subjectId(),
                request.topic(),
                request.bloom(),
                request.rubricId(),
                request.count()
        );
    }

    @PatchMapping("/questions/{id}")
    public QuestionItem review(
            @AuthenticationPrincipal PublicUser reviewer,
            @PathVariable String id,
            @Valid @RequestBody ReviewRequest request
    ) {
        return teaching.review(
                reviewer,
                id,
                request.prompt(),
                request.bloom(),
                request.status(),
                request.topic(),
                request.expectedAnswer(),
                request.keyPoints()
        );
    }

    @DeleteMapping("/questions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteQuestion(
            @AuthenticationPrincipal PublicUser teacher,
            @PathVariable String id
    ) {
        teaching.deleteQuestion(teacher, id);
    }

    @GetMapping("/exams")
    public List<ExamListItem> exams(@AuthenticationPrincipal PublicUser teacher) {
        return teaching.exams(teacher);
    }

    @GetMapping("/exams/{id}")
    public ExamDetailItem exam(@AuthenticationPrincipal PublicUser teacher, @PathVariable String id) {
        return teaching.exam(teacher, id);
    }

    @PostMapping("/exams")
    public ExamListItem start(@AuthenticationPrincipal PublicUser teacher, @Valid @RequestBody StartExamRequest request) {
        return teaching.startExam(teacher, request.title(), request.format(), request.subjectId(),
                request.questionIds(), request.durationMinutes(), request.maxFollowUps(),
                request.answerTimeLimitSec());
    }

    @PatchMapping("/exams/{id}")
    public ExamListItem renameExam(
            @AuthenticationPrincipal PublicUser teacher,
            @PathVariable String id,
            @Valid @RequestBody RenameExamRequest request
    ) {
        return teaching.renameExam(teacher, id, request.title());
    }

    @PatchMapping("/exams/{id}/status")
    public ExamListItem examStatus(
            @AuthenticationPrincipal PublicUser teacher,
            @PathVariable String id,
            @Valid @RequestBody ExamStatusRequest request
    ) {
        return teaching.setExamStatus(teacher, id, request.status());
    }

    @PutMapping("/exams/{id}/questions")
    public ExamDetailItem examQuestions(
            @AuthenticationPrincipal PublicUser teacher,
            @PathVariable String id,
            @Valid @RequestBody ExamQuestionsRequest request
    ) {
        return teaching.replaceExamQuestions(teacher, id, request.questionIds());
    }

    @DeleteMapping("/exams/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteExam(@AuthenticationPrincipal PublicUser teacher, @PathVariable String id) {
        teaching.deleteExam(teacher, id);
    }

    @GetMapping("/scores")
    public List<AttemptItem> scores(@AuthenticationPrincipal PublicUser teacher) {
        return teaching.scores(teacher);
    }

    @PatchMapping("/scores/{id}")
    public void score(
            @AuthenticationPrincipal PublicUser teacher,
            @PathVariable String id,
            @Valid @RequestBody ScoreRequest request
    ) {
        teaching.score(teacher, id, request.score());
    }

    public record DocumentTopicRequest(@NotBlank @Size(max = 255) String topic) {
    }

    public record SubjectRequest(@NotBlank String code, @NotBlank String name) {
    }

    public record QuestionRequest(
            @NotBlank String subjectId,
            @NotBlank String topic,
            @NotBlank String prompt,
            @NotBlank String bloom,
            @NotBlank String rubricId
    ) {
    }

    public record ImportRequest(
            @NotBlank String subjectId,
            @NotBlank String topic,
            @NotBlank String bloom,
            @NotBlank String rubricId,
            @NotBlank String text
    ) {
    }

    public record GenerateRequest(
            @NotBlank String subjectId,
            @NotBlank String topic,
            @NotBlank String bloom,
            @NotBlank String rubricId,
            @Min(1) @Max(10) int count
    ) {
    }

    public record ReviewRequest(
            @NotBlank String prompt,
            @NotBlank String bloom,
            @NotBlank String status,
            String topic,
            String expectedAnswer,
            String keyPoints
    ) {
    }

    public record StartExamRequest(
            @NotBlank String title,
            @NotBlank String format,
            @NotBlank String subjectId,
            @NotNull List<String> questionIds,
            @Min(1) @Max(600) Integer durationMinutes,
            @Min(0) @Max(5) Integer maxFollowUps,
            @Min(0) @Max(1800) Integer answerTimeLimitSec
    ) {
    }

    public record ScoreRequest(int score) {
    }

    public record UpdateRubricRequest(
            @NotBlank String name,
            String description,
            @NotNull List<RubricCriterionItem> criteria
    ) {
    }

    public record CreateRubricRequest(
            @NotBlank String subjectId,
            @NotBlank String name,
            String description,
            @NotNull List<RubricCriterionItem> criteria
    ) {
    }

    public record RubricDraftRequest(
            @NotBlank String subjectId,
            @Size(max = 255) String focus,
            @Min(2) @Max(8) Integer criteriaCount,
            Double totalPoints
    ) {
    }

    public record RenameExamRequest(@NotBlank @Size(max = 255) String title) {
    }

    public record ExamStatusRequest(@NotBlank String status) {
    }

    public record ExamQuestionsRequest(@NotNull List<String> questionIds) {
    }
}
