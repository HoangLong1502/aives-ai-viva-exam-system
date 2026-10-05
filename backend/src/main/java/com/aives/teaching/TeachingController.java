package com.aives.teaching;

import com.aives.rag.DocumentIngestionService.IngestedDocument;
import com.aives.teaching.DeskRecords.AttemptItem;
import com.aives.teaching.DeskRecords.QuestionItem;
import com.aives.teaching.DeskRecords.RubricItem;
import com.aives.teaching.DeskRecords.SubjectItem;
import com.aives.user.PublicUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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

    @GetMapping("/documents")
    public List<IngestedDocument> documents(
            @AuthenticationPrincipal PublicUser teacher,
            @RequestParam String subjectId
    ) {
        return teaching.documents(teacher, subjectId);
    }

    @PostMapping(value = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public IngestedDocument upload(
            @AuthenticationPrincipal PublicUser teacher,
            @RequestParam String subjectId,
            @RequestParam MultipartFile file
    ) {
        return teaching.upload(teacher, subjectId, file);
    }

    @GetMapping("/questions")
    public List<QuestionItem> questions(@RequestParam(required = false) String status) {
        return teaching.questions(status);
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
        return teaching.review(reviewer, id, request.prompt(), request.bloom(), request.status());
    }

    @PostMapping("/exams")
    public void start(@AuthenticationPrincipal PublicUser teacher, @Valid @RequestBody StartExamRequest request) {
        teaching.startExam(teacher, request.title(), request.format(), request.subjectId(), request.questionIds());
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

    public record ReviewRequest(@NotBlank String prompt, @NotBlank String bloom, @NotBlank String status) {
    }

    public record StartExamRequest(
            @NotBlank String title,
            @NotBlank String format,
            @NotBlank String subjectId,
            @NotNull List<String> questionIds
    ) {
    }

    public record ScoreRequest(int score) {
    }
}
