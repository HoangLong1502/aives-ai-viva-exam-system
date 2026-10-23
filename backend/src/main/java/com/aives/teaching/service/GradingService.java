package com.aives.teaching.service;

import com.aives.teaching.grading.AttemptScoring;
import com.aives.teaching.repository.JdbcDeskRepository;
import com.aives.teaching.repository.JdbcGradingRepository;
import com.aives.teaching.dto.DeskRecords.QuestionItem;
import com.aives.teaching.dto.GradingRecords.AttemptGrading;
import com.aives.teaching.dto.GradingRecords.CourseGradingItem;
import com.aives.teaching.dto.GradingRecords.ExamGradingItem;
import com.aives.teaching.dto.GradingRecords.ExamParticipants;
import com.aives.teaching.dto.GradingRecords.GradedAttemptResult;
import com.aives.teaching.dto.GradingRecords.ParticipantItem;
import com.aives.teaching.dto.GradingRecords.QuestionGrading;
import com.aives.teaching.dto.GradingRecords.TurnItem;
import com.aives.teaching.repository.JdbcGradingRepository.AttemptHeader;
import com.aives.teaching.repository.JdbcGradingRepository.TurnRow;
import com.aives.user.dto.PublicUser;
import com.aives.web.ApiException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lets a teacher browse their courses, exams and participants and mark each question; every saved mark
 * recalculates the attempt's final score from the per-question marks.
 */
@Service
public class GradingService {

    private final JdbcGradingRepository grading;
    private final JdbcDeskRepository desk;

    public GradingService(JdbcGradingRepository grading, JdbcDeskRepository desk) {
        this.grading = grading;
        this.desk = desk;
    }

    public List<CourseGradingItem> courses(PublicUser teacher) {
        return grading.courses(teacher.id());
    }

    public List<ExamGradingItem> exams(PublicUser teacher, String courseId) {
        if (!grading.teacherOwnsCourse(teacher.id(), courseId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Course not found");
        }
        return grading.examsInCourse(teacher.id(), courseId);
    }

    public ExamParticipants participants(PublicUser teacher, String examId) {
        String[] header = grading.examHeader(teacher.id(), examId);
        if (header == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Exam not found");
        }
        List<ParticipantItem> participants = grading.participants(examId);
        List<ParticipantItem> submitted = participants.stream()
                .filter(participant -> "SUBMITTED".equals(participant.status()))
                .toList();
        int graded = (int) submitted.stream()
                .filter(participant -> participant.gradedCount() >= participant.answeredCount())
                .count();
        Double average = submitted.stream()
                .filter(participant -> participant.score() != null)
                .mapToInt(ParticipantItem::score)
                .average()
                .stream()
                .boxed()
                .findFirst()
                .orElse(null);
        return new ExamParticipants(
                examId, header[0], header[1], header[2], submitted.size(), graded, average, participants);
    }

    public AttemptGrading attempt(PublicUser teacher, String attemptId) {
        return grading(requireAttempt(teacher, attemptId), attemptId);
    }

    /**
     * The student's own submitted attempt: every question with the dialogue, the AI feedback, and the
     * teacher's mark and comment. The model answer, key points and which grader ran stay with the teacher.
     */
    public AttemptGrading studentReview(PublicUser student, String attemptId) {
        AttemptHeader header = grading.attemptHeaderForStudent(student.id(), attemptId);
        if (header == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Attempt not found");
        }
        if (!"SUBMITTED".equals(header.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "Submit the exam before reviewing it");
        }
        AttemptGrading full = grading(header, attemptId);
        List<QuestionGrading> questions = full.questions().stream()
                .map(question -> new QuestionGrading(
                        question.questionId(), question.number(), question.prompt(), null, null,
                        question.answered(), question.aiScore(), question.teacherScore(), question.teacherFeedback(),
                        question.turns().stream()
                                .map(turn -> new TurnItem(
                                        turn.turnId(), turn.turnNo(), turn.turnType(), turn.questionText(),
                                        turn.transcript(), turn.answered(), turn.aiScore(), turn.aiFeedback(), null))
                                .toList()))
                .toList();
        return new AttemptGrading(
                full.attemptId(), full.examId(), full.examTitle(), full.courseId(), full.courseName(),
                full.studentName(), full.studentCode(), full.status(), full.score(), full.pointsPerQuestion(),
                questions);
    }

    private AttemptGrading grading(AttemptHeader header, String attemptId) {
        List<QuestionItem> examQuestions = desk.questionsOnExam(header.examId());
        Map<String, List<TurnRow>> turnsByQuestion = grading.turns(attemptId).stream()
                .collect(Collectors.groupingBy(TurnRow::questionId, LinkedHashMap::new, Collectors.toList()));
        List<QuestionGrading> questions = new ArrayList<>();
        for (int index = 0; index < examQuestions.size(); index++) {
            QuestionItem question = examQuestions.get(index);
            questions.add(toQuestionGrading(index + 1, question, turnsByQuestion.getOrDefault(question.id(), List.of())));
        }
        return new AttemptGrading(
                header.attemptId(), header.examId(), header.examTitle(), header.courseId(), header.courseName(),
                header.studentName(), header.studentCode(), header.status(), header.score(),
                AttemptScoring.pointsPerQuestion(examQuestions.size()), questions);
    }

    private static QuestionGrading toQuestionGrading(int number, QuestionItem question, List<TurnRow> rows) {
        List<TurnItem> turns = rows.stream()
                .map(row -> new TurnItem(
                        row.turnId(), row.turnNo(), row.turnType(), row.questionText(), row.transcript(),
                        row.answered(), row.aiScore(), row.aiFeedback(), row.evaluator()))
                .toList();
        Double ai = rows.stream().map(TurnRow::aiScore).filter(Objects::nonNull).max(Double::compare).orElse(null);
        Double teacherScore = rows.stream()
                .map(TurnRow::teacherScore).filter(Objects::nonNull).max(Double::compare).orElse(null);
        String feedback = rows.stream()
                .filter(row -> row.teacherScore() != null && row.teacherFeedback() != null)
                .map(TurnRow::teacherFeedback)
                .findFirst()
                .orElse(null);
        return new QuestionGrading(
                question.id(), number, question.prompt(), question.expectedAnswer(), question.keyPoints(),
                rows.stream().anyMatch(TurnRow::answered), ai, teacherScore, feedback, turns);
    }

    /**
     * Saves the teacher's mark for one question, given in points out of the question's share of the exam
     * (100 split equally across the exam's questions). The mark covers the main turn and its follow-ups.
     */
    @Transactional
    public GradedAttemptResult markQuestion(
            PublicUser teacher, String attemptId, String questionId, double points, String feedback) {
        AttemptHeader header = requireAttempt(teacher, attemptId);
        List<QuestionItem> examQuestions = desk.questionsOnExam(header.examId());
        if (examQuestions.stream().noneMatch(question -> question.id().equals(questionId))) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Question not found on this exam");
        }
        double max = AttemptScoring.pointsPerQuestion(examQuestions.size());
        if (Double.isNaN(points) || points < 0 || points > max) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Score must be between 0 and " + Math.round(max * 100) / 100.0);
        }
        String note = feedback == null || feedback.isBlank() ? null : feedback.trim();
        if (grading.saveTeacherMark(attemptId, questionId, teacher.id(), points / max * 100.0, note) == 0) {
            throw new ApiException(HttpStatus.CONFLICT, "The student did not answer this question");
        }
        return new GradedAttemptResult(recalculate(attemptId, examQuestions));
    }

    private int recalculate(String attemptId, List<QuestionItem> examQuestions) {
        List<String> questions = examQuestions.stream().map(QuestionItem::id).toList();
        Map<String, Double> best = desk.bestAnswerScores(attemptId);
        int score = AttemptScoring.finalScore(questions, best);
        grading.updateAttemptScore(attemptId, score);
        return score;
    }

    private AttemptHeader requireAttempt(PublicUser teacher, String attemptId) {
        AttemptHeader header = grading.attemptHeader(teacher.id(), attemptId);
        if (header == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Attempt not found");
        }
        return header;
    }
}
