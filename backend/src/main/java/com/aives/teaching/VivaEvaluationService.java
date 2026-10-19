package com.aives.teaching;

import com.aives.ai.ChatCompletionClient;
import com.aives.ai.ChatCompletionClient.AiUnavailableException;
import com.aives.ai.ChatCompletionClient.Completion;
import com.aives.rag.DocumentIngestionService;
import com.aives.rag.VivaQuestionGenerator.Passage;
import com.aives.teaching.DeskRecords.QuestionItem;
import com.aives.teaching.DeskRecords.RubricCriterionItem;
import com.aives.teaching.DeskRecords.RubricDetailItem;
import com.aives.teaching.DeskRecords.SubmitAttemptResult;
import com.aives.teaching.DeskRecords.VivaEvaluationItem;
import com.aives.teaching.DeskRecords.VivaTurnItem;
import com.aives.teaching.GradingResponseParser.InvalidGradingResponse;
import com.aives.user.PublicUser;
import com.aives.web.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VivaEvaluationService {

    private static final Logger log = LoggerFactory.getLogger(VivaEvaluationService.class);
    private static final int MATERIAL_LIMIT = 4;

    private final ObjectMapper mapper;
    private final JdbcDeskRepository desk;
    private final ChatCompletionClient ai;
    private final DocumentIngestionService documents;

    public VivaEvaluationService(
            ObjectMapper mapper,
            JdbcDeskRepository desk,
            ChatCompletionClient ai,
            DocumentIngestionService documents
    ) {
        this.mapper = mapper;
        this.desk = desk;
        this.ai = ai;
        this.documents = documents;
    }

    @Transactional
    public VivaEvaluationItem evaluateMainQuestion(
            PublicUser student,
            String examId,
            String questionId,
            String studentAnswer,
            Integer durationMs
    ) {
        String attemptId = openAttempt(examId, student.id());
        QuestionItem question = desk.questionsOnExam(examId).stream()
                .filter(item -> item.id().equals(questionId))
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Question not found on this exam"));

        List<VivaTurnItem> previous = desk.turnsForAttempt(attemptId);
        UUID turnId = UUID.randomUUID();
        int turnNo = desk.nextTurnNo(attemptId);
        desk.insertTurn(turnId, attemptId, questionId, null, turnNo, "MAIN", null, question.prompt());

        VivaEvaluationItem evaluation = evaluate(
                question,
                studentAnswer,
                false,
                turnId.toString(),
                questionId,
                history(previous, questionId),
                0,
                question.prompt()
        );
        storeAnswer(turnId, studentAnswer, durationMs, evaluation);
        return evaluation;
    }

    @Transactional
    public VivaEvaluationItem evaluateFollowUp(
            PublicUser student,
            String examId,
            String parentTurnId,
            String studentAnswer,
            Integer durationMs,
            String askedQuestion
    ) {
        String attemptId = openAttempt(examId, student.id());

        List<VivaTurnItem> previousTurns = desk.turnsForAttempt(attemptId);
        VivaTurnItem parent = previousTurns.stream()
                .filter(t -> t.turnId().equals(parentTurnId))
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Previous question turn not found"));

        QuestionItem question = desk.question(parent.questionId());
        if (question == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Associated question not found");
        }

        int priorFollowUps = (int) previousTurns.stream()
                .filter(turn -> parent.questionId().equals(turn.questionId()) && "FOLLOW_UP".equals(turn.turnType()))
                .count();
        String questionText = askedQuestion == null || askedQuestion.isBlank()
                ? question.prompt()
                : askedQuestion.trim();
        if (questionText.length() > 2000) {
            questionText = questionText.substring(0, 2000);
        }

        UUID turnId = UUID.randomUUID();
        int turnNo = desk.nextTurnNo(attemptId);
        desk.insertTurn(
                turnId,
                attemptId,
                parent.questionId(),
                parentTurnId,
                turnNo,
                "FOLLOW_UP",
                priorFollowUps + 1,
                questionText
        );

        VivaEvaluationItem evaluation = evaluate(
                question,
                studentAnswer,
                true,
                turnId.toString(),
                parent.questionId(),
                history(previousTurns, parent.questionId()),
                priorFollowUps + 1,
                questionText
        );
        storeAnswer(turnId, studentAnswer, durationMs, evaluation);
        return evaluation;
    }

    public List<VivaTurnItem> getTurns(PublicUser student, String examId) {
        String attemptId = desk.findAttemptId(examId, student.id());
        if (attemptId == null) {
            return List.of();
        }
        return desk.turnsForAttempt(attemptId);
    }

    /**
     * Submits the attempt with a score computed from the answers stored on the server. Any score the
     * client might send is ignored.
     */
    @Transactional
    public SubmitAttemptResult submitExam(PublicUser student, String examId) {
        String attemptId = openAttempt(examId, student.id());
        List<String> questions = desk.questionsOnExam(examId).stream().map(QuestionItem::id).toList();
        Map<String, Double> best = desk.bestAnswerScores(attemptId);
        int finalScore = AttemptScoring.finalScore(questions, best);
        if (!desk.submitAttempt(attemptId, finalScore)) {
            throw new ApiException(HttpStatus.CONFLICT, "This exam has already been submitted");
        }
        int answered = (int) questions.stream().filter(best::containsKey).count();
        return new SubmitAttemptResult(finalScore, answered, questions.size());
    }

    /** Returns the student's attempt, creating it if needed, and rejects changes once it is submitted. */
    private String openAttempt(String examId, String studentId) {
        String attemptId = getOrCreateAttempt(examId, studentId);
        if ("SUBMITTED".equals(desk.attemptStatus(attemptId))) {
            throw new ApiException(HttpStatus.CONFLICT, "This exam has already been submitted");
        }
        return attemptId;
    }

    private String getOrCreateAttempt(String examId, String studentId) {
        String attemptId = desk.findAttemptId(examId, studentId);
        if (attemptId == null) {
            UUID newId = UUID.randomUUID();
            desk.enterExam(newId, examId, studentId);
            return newId.toString();
        }
        return attemptId;
    }

    private void storeAnswer(UUID turnId, String studentAnswer, Integer durationMs, VivaEvaluationItem evaluation) {
        String reason = switch (evaluation.nextAction()) {
            case VivaTurnFlow.FOLLOW_UP -> "MISSING_KEY_POINTS";
            case VivaTurnFlow.ASK_CONTINUE -> "STUDENT_STUCK";
            default -> null;
        };
        desk.insertAnswer(
                UUID.randomUUID(),
                turnId.toString(),
                studentAnswer,
                VivaTurnFlow.FOLLOW_UP.equals(evaluation.nextAction()),
                reason,
                durationMs,
                evaluation.score(),
                evaluation.isSufficient(),
                evaluation.feedback(),
                evaluation.evaluator()
        );
    }

    private static List<GradingPrompt.PriorTurn> history(List<VivaTurnItem> turns, String questionId) {
        return turns.stream()
                .filter(turn -> questionId.equals(turn.questionId()))
                .map(turn -> new GradingPrompt.PriorTurn(turn.questionText(), turn.transcript()))
                .toList();
    }

    private VivaEvaluationItem evaluate(
            QuestionItem question,
            String studentAnswer,
            boolean isFollowUp,
            String turnId,
            String questionId,
            List<GradingPrompt.PriorTurn> history,
            int followUpDepth,
            String examinerJustAsked
    ) {
        String cleanAnswer = studentAnswer == null ? "" : studentAnswer.trim();
        String language = detectPromptLanguage(question.prompt());
        List<String> materials = courseMaterials(question);
        List<RubricCriterionItem> criteria = rubricCriteria(question);

        if (ai.configured() && !cleanAnswer.isBlank()) {
            try {
                return item(
                        gradeWithAi(question, criteria, cleanAnswer, isFollowUp, language, history, examinerJustAsked, materials),
                        followUpDepth,
                        turnId,
                        questionId,
                        "AI",
                        null
                );
            } catch (Exception exception) {
                log.warn(
                        "AI grading failed for question {} (turn {}); recovering with materials: {}",
                        questionId,
                        turnId,
                        exception.getMessage()
                );
            }
        }

        Grade grade = RuleBasedGrader.grade(
                question,
                cleanAnswer,
                isFollowUp,
                "English".equals(language),
                materials
        );
        String reason = !ai.configured()
                ? "AI grader is not configured; scored from the question and course materials"
                : cleanAnswer.isBlank()
                        ? "No answer was captured"
                        : "AI grader failed after recovery; scored from the question and course materials";
        return item(grade, followUpDepth, turnId, questionId, "RULE_BASED", reason);
    }

    private Grade gradeWithAi(
            QuestionItem question,
            List<RubricCriterionItem> criteria,
            String cleanAnswer,
            boolean isFollowUp,
            String language,
            List<GradingPrompt.PriorTurn> history,
            String examinerJustAsked,
            List<String> materials
    ) {
        List<Map<String, Object>> messages = GradingPrompt.messages(
                question, criteria, cleanAnswer, isFollowUp, language, history, examinerJustAsked, materials
        );
        String raw;
        try {
            raw = ai.complete(request(messages, true)).content();
        } catch (AiUnavailableException unavailable) {
            log.warn("Strict AI grading unavailable ({}); retrying without JSON mode", unavailable.getMessage());
            raw = ai.complete(request(messages, false)).content();
        }
        try {
            return GradingResponseParser.parse(raw, criteria, mapper);
        } catch (InvalidGradingResponse invalid) {
            log.warn("Repairing invalid AI grading JSON: {}", invalid.getMessage());
            String repaired = ai.complete(request(
                    GradingPrompt.repairMessages(raw, invalid.getMessage(), language),
                    true
            )).content();
            return GradingResponseParser.parse(repaired, criteria, mapper);
        }
    }

    private static Map<String, Object> request(List<Map<String, Object>> messages, boolean jsonMode) {
        Map<String, Object> body = new HashMap<>();
        body.put("temperature", 0.1);
        body.put("messages", messages);
        if (jsonMode) {
            body.put("response_format", Map.of("type", "json_object"));
        }
        return body;
    }

    private List<String> courseMaterials(QuestionItem question) {
        String query = ((question.topic() == null ? "" : question.topic()) + " " +
                (question.prompt() == null ? "" : question.prompt()) + " " +
                (question.keyPoints() == null ? "" : question.keyPoints())).trim();
        if (query.isBlank() || question.subjectId() == null) {
            return List.of();
        }
        try {
            List<Passage> passages = documents.retrieveForCourse(question.subjectId(), query, MATERIAL_LIMIT);
            List<String> materials = new ArrayList<>(passages.size());
            for (Passage passage : passages) {
                String label = passage.source() == null ? "" : passage.source().trim();
                String text = passage.text() == null ? "" : passage.text().trim();
                if (text.isBlank()) {
                    continue;
                }
                materials.add(label.isBlank() ? text : label + ": " + text);
            }
            return materials;
        } catch (Exception exception) {
            log.warn("Could not load course materials for grading: {}", exception.getMessage());
            return List.of();
        }
    }

    private List<RubricCriterionItem> rubricCriteria(QuestionItem question) {
        if (question.rubricId() == null) {
            return List.of();
        }
        RubricDetailItem rubric = desk.rubricDetail(question.rubricId());
        return rubric == null ? List.of() : rubric.criteria();
    }

    private static VivaEvaluationItem item(
            Grade grade,
            int followUpDepth,
            String turnId,
            String questionId,
            String evaluator,
            String fallbackReason
    ) {
        VivaTurnFlow.Decision decision = VivaTurnFlow.decide(grade, followUpDepth);
        return new VivaEvaluationItem(
                turnId,
                questionId,
                grade.score(),
                grade.sufficient(),
                grade.feedback(),
                decision.followUpQuestion(),
                evaluator,
                fallbackReason,
                grade.criteria(),
                decision.nextAction()
        );
    }

    private static String detectPromptLanguage(String prompt) {
        if (prompt == null || prompt.isBlank()) {
            return "Vietnamese";
        }
        // Vietnamese diacritics → Vietnamese; otherwise treat Latin-only as English
        if (prompt.matches("(?s).*[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ].*")) {
            return "Vietnamese";
        }
        long letters = prompt.chars().filter(Character::isLetter).count();
        long ascii = prompt.chars().filter(c -> (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')).count();
        if (letters > 0 && (double) ascii / letters >= 0.85) {
            return "English";
        }
        return "Vietnamese";
    }
}
