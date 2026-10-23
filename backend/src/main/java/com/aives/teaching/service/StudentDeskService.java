package com.aives.teaching.service;

import com.aives.teaching.repository.JdbcDeskRepository;
import com.aives.teaching.dto.DeskRecords.AttemptItem;
import com.aives.teaching.dto.DeskRecords.ExamQuestionItem;
import com.aives.teaching.dto.DeskRecords.QuestionItem;
import com.aives.teaching.dto.DeskRecords.SessionItem;
import com.aives.teaching.dto.DeskRecords.SpeechSettings;
import java.util.List;
import java.util.UUID;
import com.aives.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class StudentDeskService {

    private final JdbcDeskRepository desk;

    public StudentDeskService(JdbcDeskRepository desk) {
        this.desk = desk;
    }

    public SpeechSettings speech() {
        return desk.speechSettings();
    }

    public List<SessionItem> exams(String studentId) {
        return desk.sessionsForStudent(studentId);
    }

    /** Starts or resumes the student's attempt; a submitted exam cannot be sat again. */
    public void enter(String studentId, String examId) {
        requireOpenExam(examId);
        String existing = desk.findAttemptId(examId, studentId);
        if (existing != null && "SUBMITTED".equals(desk.attemptStatus(existing))) {
            throw new ApiException(HttpStatus.CONFLICT, "You have already submitted this exam");
        }
        desk.enterExam(UUID.randomUUID(), examId, studentId);
    }

    /** Questions are only served for an open exam the student has entered. */
    public List<ExamQuestionItem> questions(String studentId, String examId) {
        requireOpenExam(examId);
        if (desk.findAttemptId(examId, studentId) == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Enter the exam before loading its questions");
        }
        return desk.questionsOnExam(examId).stream()
                .map(StudentDeskService::withoutAnswers)
                .toList();
    }

    public List<AttemptItem> scores(String studentId) {
        return desk.attemptsForStudent(studentId);
    }

    private void requireOpenExam(String examId) {
        String status = desk.examStatus(examId);
        if (status == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Exam not found");
        }
        if (!"IN_PROGRESS".equals(status)) {
            throw new ApiException(HttpStatus.CONFLICT, "This exam is not open");
        }
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
