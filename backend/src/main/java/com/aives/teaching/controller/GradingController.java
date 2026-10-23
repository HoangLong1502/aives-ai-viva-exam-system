package com.aives.teaching.controller;

import com.aives.teaching.service.GradingService;
import com.aives.teaching.dto.GradingRecords.AttemptGrading;
import com.aives.teaching.dto.GradingRecords.CourseGradingItem;
import com.aives.teaching.dto.GradingRecords.ExamGradingItem;
import com.aives.teaching.dto.GradingRecords.ExamParticipants;
import com.aives.teaching.dto.GradingRecords.GradedAttemptResult;
import com.aives.user.dto.PublicUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/teaching/grading")
public class GradingController {

    private final GradingService grading;

    public GradingController(GradingService grading) {
        this.grading = grading;
    }

    @GetMapping("/courses")
    public List<CourseGradingItem> courses(@AuthenticationPrincipal PublicUser teacher) {
        return grading.courses(teacher);
    }

    @GetMapping("/courses/{courseId}/exams")
    public List<ExamGradingItem> exams(
            @AuthenticationPrincipal PublicUser teacher,
            @PathVariable String courseId
    ) {
        return grading.exams(teacher, courseId);
    }

    @GetMapping("/exams/{examId}/participants")
    public ExamParticipants participants(
            @AuthenticationPrincipal PublicUser teacher,
            @PathVariable String examId
    ) {
        return grading.participants(teacher, examId);
    }

    @GetMapping("/attempts/{attemptId}")
    public AttemptGrading attempt(
            @AuthenticationPrincipal PublicUser teacher,
            @PathVariable String attemptId
    ) {
        return grading.attempt(teacher, attemptId);
    }

    @PutMapping("/attempts/{attemptId}/questions/{questionId}")
    public GradedAttemptResult markQuestion(
            @AuthenticationPrincipal PublicUser teacher,
            @PathVariable String attemptId,
            @PathVariable String questionId,
            @Valid @RequestBody MarkRequest request
    ) {
        return grading.markQuestion(teacher, attemptId, questionId, request.score(), request.feedback());
    }

    public record MarkRequest(
            @DecimalMin("0") double score,
            @Size(max = 2000) String feedback
    ) {
    }
}
