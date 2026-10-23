package com.aives.teaching.service;

import com.aives.teaching.repository.JdbcDeskRepository;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aives.ai.ChatCompletionClient;
import com.aives.rag.service.DocumentIngestionService;
import com.aives.teaching.dto.DeskRecords.QuestionItem;
import com.aives.teaching.dto.DeskRecords.VivaTurnItem;
import com.aives.teaching.repository.JdbcDeskRepository.TurnLimits;
import com.aives.user.dto.PublicUser;
import com.aives.user.model.Role;
import com.aives.web.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class VivaEvaluationServiceTest {

    private static final String EXAM = UUID.randomUUID().toString();
    private static final String ATTEMPT = UUID.randomUUID().toString();
    private static final String Q1 = UUID.randomUUID().toString();
    private static final PublicUser STUDENT = new PublicUser("s1", "s@aives.test", "Student", Role.STUDENT);

    private JdbcDeskRepository desk;
    private VivaEvaluationService service;

    @BeforeEach
    void setUp() {
        desk = mock(JdbcDeskRepository.class);
        ChatCompletionClient ai = mock(ChatCompletionClient.class);
        when(ai.configured()).thenReturn(false);
        service = new VivaEvaluationService(new ObjectMapper(), desk, ai, mock(DocumentIngestionService.class));
        when(desk.examStatus(EXAM)).thenReturn("IN_PROGRESS");
        when(desk.findAttemptId(EXAM, "s1")).thenReturn(ATTEMPT);
        when(desk.attemptStatus(ATTEMPT)).thenReturn("IN_PROGRESS");
        when(desk.questionsOnExam(EXAM)).thenReturn(List.of(question()));
        when(desk.question(Q1)).thenReturn(question());
        when(desk.nextTurnNo(ATTEMPT)).thenReturn(2);
        when(desk.attemptRemainingSeconds(ATTEMPT)).thenReturn(600);
        when(desk.turnLimits(EXAM)).thenReturn(new TurnLimits(2, 60));
    }

    @Test
    void answeringIsRejectedOnceTheExamIsClosed() {
        when(desk.examStatus(EXAM)).thenReturn("COMPLETED");

        ApiException error = assertThrows(ApiException.class,
                () -> service.evaluateMainQuestion(STUDENT, EXAM, Q1, "answer", 10));

        assertEquals(HttpStatus.CONFLICT, error.status());
        verify(desk, never()).insertTurn(any(), anyString(), anyString(), any(), anyInt(), anyString(), any(), anyString());
    }

    @Test
    void anAnsweredMainQuestionCannotBeAnsweredAgain() {
        when(desk.turnsForAttempt(ATTEMPT)).thenReturn(List.of(turn("t1", 1, "MAIN", "Prompt?")));

        ApiException error = assertThrows(ApiException.class,
                () -> service.evaluateMainQuestion(STUDENT, EXAM, Q1, "answer", 10));

        assertEquals(HttpStatus.CONFLICT, error.status());
    }

    @Test
    void aFollowUpMustContinueTheLatestTurnOfTheQuestion() {
        when(desk.turnsForAttempt(ATTEMPT)).thenReturn(List.of(
                turn("t1", 1, "MAIN", "Prompt?"),
                turn("t2", 2, "FOLLOW_UP", "More?")
        ));

        ApiException error = assertThrows(ApiException.class,
                () -> service.evaluateFollowUp(STUDENT, EXAM, "t1", "answer", 10));

        assertEquals(HttpStatus.CONFLICT, error.status());
    }

    @Test
    void theFollowUpQuestionComesFromTheServerNotTheClient() {
        when(desk.turnsForAttempt(ATTEMPT)).thenReturn(List.of(turn("t1", 1, "MAIN", "Prompt?")));
        when(desk.storedFollowUpQuestion("t1")).thenReturn("What about nulls?");

        service.evaluateFollowUp(STUDENT, EXAM, "t1", "some answer about nulls", 10);

        verify(desk).insertTurn(any(), eq(ATTEMPT), eq(Q1), eq("t1"), eq(2), eq("FOLLOW_UP"), eq(1),
                eq("What about nulls?"));
    }

    @Test
    void aMainAnswerPastTheTimeLimitIsRejected() {
        when(desk.turnsForAttempt(ATTEMPT)).thenReturn(List.of());

        ApiException error = assertThrows(ApiException.class,
                () -> service.evaluateMainQuestion(STUDENT, EXAM, Q1, "answer", 75_000));

        assertEquals(HttpStatus.CONFLICT, error.status());
        verify(desk, never()).insertTurn(any(), anyString(), anyString(), any(), anyInt(), anyString(), any(), anyString());
    }

    @Test
    void aFollowUpAnsweredLongAfterItWasAskedIsRejectedEvenIfTheClientSaysOtherwise() {
        when(desk.turnsForAttempt(ATTEMPT)).thenReturn(List.of(turn("t1", 1, "MAIN", "Prompt?")));
        when(desk.secondsSinceAnswered("t1")).thenReturn(600);
        when(desk.storedFollowUpQuestion("t1")).thenReturn("What about nulls?");

        ApiException error = assertThrows(ApiException.class,
                () -> service.evaluateFollowUp(STUDENT, EXAM, "t1", "answer", 10));

        assertEquals(HttpStatus.CONFLICT, error.status());
    }

    @Test
    void anExamWithoutATimeLimitAcceptsSlowAnswers() {
        when(desk.turnLimits(EXAM)).thenReturn(new TurnLimits(2, 0));
        when(desk.turnsForAttempt(ATTEMPT)).thenReturn(List.of());

        service.evaluateMainQuestion(STUDENT, EXAM, Q1, "answer about nulls", 900_000);

        verify(desk).insertTurn(any(), eq(ATTEMPT), eq(Q1), eq(null), eq(2), eq("MAIN"), eq(null), eq("Prompt?"));
    }

    private static VivaTurnItem turn(String id, int no, String type, String text) {
        return new VivaTurnItem(id, Q1, null, no, type, text, "a", false, "", "");
    }

    private static QuestionItem question() {
        return new QuestionItem(Q1, null, null, "Topic", "Prompt?", null, null, null, null, 10, "APPROVED",
                null, null, null, "Expected answer about nulls", "nulls; defaults");
    }
}
