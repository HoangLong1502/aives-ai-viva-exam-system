package com.aives.teaching.controller;

import com.aives.teaching.service.GradingService;
import com.aives.teaching.service.StudentDeskService;
import com.aives.teaching.service.VivaEvaluationService;
import com.aives.teaching.dto.DeskRecords.AnswerSubmissionRequest;
import com.aives.teaching.dto.DeskRecords.AttemptItem;
import com.aives.teaching.dto.DeskRecords.ExamQuestionItem;
import com.aives.teaching.dto.DeskRecords.SessionItem;
import com.aives.teaching.dto.DeskRecords.SpeechSettings;
import com.aives.teaching.dto.DeskRecords.SubmitAttemptResult;
import com.aives.teaching.dto.DeskRecords.VivaEvaluationItem;
import com.aives.teaching.dto.DeskRecords.VivaTurnItem;
import com.aives.teaching.dto.GradingRecords.AttemptGrading;
import com.aives.user.dto.PublicUser;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/student")
public class StudentDeskController {

    private final StudentDeskService desk;
    private final VivaEvaluationService evaluationService;
    private final GradingService grading;

    public StudentDeskController(
            StudentDeskService desk,
            VivaEvaluationService evaluationService,
            GradingService grading
    ) {
        this.desk = desk;
        this.evaluationService = evaluationService;
        this.grading = grading;
    }

    @GetMapping("/speech")
    public SpeechSettings speech() {
        return desk.speech();
    }

    @GetMapping("/exams")
    public List<SessionItem> exams(@AuthenticationPrincipal PublicUser student) {
        evaluationService.submitExpiredAttempts(student);
        return desk.exams(student.id());
    }

    @PostMapping("/exams/{id}/enter")
    public void enter(@AuthenticationPrincipal PublicUser student, @PathVariable String id) {
        evaluationService.submitExpiredAttempts(student);
        desk.enter(student.id(), id);
    }

    @GetMapping("/exams/{id}/questions")
    public List<ExamQuestionItem> questions(@AuthenticationPrincipal PublicUser student, @PathVariable String id) {
        return desk.questions(student.id(), id);
    }

    @GetMapping("/scores")
    public List<AttemptItem> scores(@AuthenticationPrincipal PublicUser student) {
        return desk.scores(student.id());
    }

    /** A submitted attempt with every answer, the AI feedback and the teacher's marks and comments. */
    @GetMapping("/attempts/{attemptId}")
    public AttemptGrading attempt(@AuthenticationPrincipal PublicUser student, @PathVariable String attemptId) {
        return grading.studentReview(student, attemptId);
    }

    @PostMapping("/exams/{id}/questions/{questionId}/answer")
    public VivaEvaluationItem answerQuestion(
            @AuthenticationPrincipal PublicUser student,
            @PathVariable String id,
            @PathVariable String questionId,
            @RequestBody AnswerSubmissionRequest request
    ) {
        return evaluationService.evaluateMainQuestion(
                student,
                id,
                questionId,
                request.answer(),
                request.durationMs()
        );
    }

    @PostMapping("/exams/{id}/turns/{turnId}/answer")
    public VivaEvaluationItem answerFollowUp(
            @AuthenticationPrincipal PublicUser student,
            @PathVariable String id,
            @PathVariable String turnId,
            @RequestBody AnswerSubmissionRequest request
    ) {
        return evaluationService.evaluateFollowUp(
                student,
                id,
                turnId,
                request.answer(),
                request.durationMs()
        );
    }

    @GetMapping("/exams/{id}/turns")
    public List<VivaTurnItem> examTurns(
            @AuthenticationPrincipal PublicUser student,
            @PathVariable String id
    ) {
        return evaluationService.getTurns(student, id);
    }

    /** The score is always computed on the server; a score in the request body is ignored. */
    @PostMapping("/exams/{id}/submit")
    public SubmitAttemptResult submitExam(
            @AuthenticationPrincipal PublicUser student,
            @PathVariable String id
    ) {
        return evaluationService.submitExam(student, id);
    }
}
