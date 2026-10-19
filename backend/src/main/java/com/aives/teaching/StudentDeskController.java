package com.aives.teaching;

import com.aives.teaching.DeskRecords.AnswerSubmissionRequest;
import com.aives.teaching.DeskRecords.AttemptItem;
import com.aives.teaching.DeskRecords.ExamQuestionItem;
import com.aives.teaching.DeskRecords.QuestionItem;
import com.aives.teaching.DeskRecords.SessionItem;
import com.aives.teaching.DeskRecords.SpeechSettings;
import com.aives.teaching.DeskRecords.SubmitAttemptResult;
import com.aives.teaching.DeskRecords.VivaEvaluationItem;
import com.aives.teaching.DeskRecords.VivaTurnItem;
import com.aives.user.PublicUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
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

    private final JdbcDeskRepository desk;
    private final VivaEvaluationService evaluationService;

    public StudentDeskController(JdbcDeskRepository desk, VivaEvaluationService evaluationService) {
        this.desk = desk;
        this.evaluationService = evaluationService;
    }

    @GetMapping("/speech")
    public SpeechSettings speech() {
        return desk.speechSettings();
    }

    @GetMapping("/exams")
    public List<SessionItem> exams(@AuthenticationPrincipal PublicUser student) {
        return desk.sessionsForStudent(student.id());
    }

    @PostMapping("/exams/{id}/enter")
    public void enter(@AuthenticationPrincipal PublicUser student, @PathVariable String id) {
        desk.enterExam(UUID.randomUUID(), id, student.id());
    }

    @GetMapping("/exams/{id}/questions")
    public List<ExamQuestionItem> questions(@PathVariable String id) {
        return desk.questionsOnExam(id).stream()
                .map(StudentDeskController::withoutAnswers)
                .toList();
    }

    @GetMapping("/scores")
    public List<AttemptItem> scores(@AuthenticationPrincipal PublicUser student) {
        return desk.attemptsForStudent(student.id());
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
                request.durationMs(),
                request.followUpQuestion()
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

    private static ExamQuestionItem withoutAnswers(QuestionItem question) {
        return new ExamQuestionItem(
                question.id(),
                question.topic(),
                question.prompt(),
                question.bloom(),
                question.rubricName(),
                question.criteria(),
                question.maxScore()
        );
    }
}
