package com.aives.teaching;

import com.aives.teaching.DeskRecords.AttemptItem;
import com.aives.teaching.DeskRecords.ExamQuestionItem;
import com.aives.teaching.DeskRecords.QuestionItem;
import com.aives.teaching.DeskRecords.SessionItem;
import com.aives.user.PublicUser;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/student")
public class StudentDeskController {

    private final JdbcDeskRepository desk;

    public StudentDeskController(JdbcDeskRepository desk) {
        this.desk = desk;
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
