package com.aives.teaching;

import com.aives.teaching.DeskRecords.AttemptItem;
import com.aives.teaching.DeskRecords.QuestionItem;
import com.aives.teaching.DeskRecords.RubricCriterionItem;
import com.aives.teaching.DeskRecords.RubricDetailItem;
import com.aives.teaching.DeskRecords.RubricItem;
import com.aives.teaching.DeskRecords.SessionItem;
import com.aives.teaching.DeskRecords.SpeechSettings;
import com.aives.teaching.DeskRecords.SubjectItem;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JdbcDeskRepository {

    private static final Map<String, String> LOCALES = Map.of("vi", "vi-VN", "en", "en-US");

    private static final String RUBRIC_CRITERIA = """
            COALESCE((SELECT string_agg(COALESCE(rc.description, rc.name), '; ' ORDER BY rc.sort_order)
                      FROM rubric_criterion rc WHERE rc.rubric_id = r.id), '')
            """;

    private static final String RUBRIC_MAX = """
            COALESCE((SELECT sum(rc.max_points) FROM rubric_criterion rc WHERE rc.rubric_id = r.id), 0)::int
            """;

    private static final String QUESTION_SELECT = """
            SELECT q.id::text, q.course_id::text, c.name, q.topic, q.prompt, q.bloom_level,
                   q.rubric_id::text, r.name, %s, %s, q.status, q.source, u.full_name,
                   q.source_ref
            FROM question q
            JOIN course c ON c.id = q.course_id
            JOIN rubric r ON r.id = q.rubric_id
            JOIN "user" u ON u.id = q.author_id
            """.formatted(RUBRIC_CRITERIA, RUBRIC_MAX);

    private static final String ATTEMPT_SELECT = """
            SELECT a.id::text, e.id::text, e.title, s.full_name, COALESCE(t.full_name, ''), a.score, e.status
            FROM exam_attempt a
            JOIN exam_session e ON e.id = a.session_id
            JOIN "user" s ON s.id = a.student_id
            LEFT JOIN "user" t ON t.id = e.teacher_id
            """;

    private final JdbcTemplate jdbc;

    public JdbcDeskRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<SubjectItem> subjects() {
        return jdbc.query(
                "SELECT id::text, code, name FROM course ORDER BY code",
                (rs, row) -> new SubjectItem(
                        rs.getString(1),
                        rs.getString(2),
                        rs.getString(3),
                        teacherIds(rs.getString(1))
                )
        );
    }

    public List<String> teacherIds(String subjectId) {
        return jdbc.query(
                "SELECT teacher_id::text FROM course_assignment WHERE course_id = ?::uuid",
                (rs, row) -> rs.getString(1),
                subjectId
        );
    }

    @Transactional
    public void insertSubject(UUID id, String code, String name, String createdBy) {
        jdbc.update(
                "INSERT INTO course (id, code, name) VALUES (?::uuid, ?, ?)",
                id.toString(),
                code,
                name
        );
        UUID rubricId = UUID.randomUUID();
        jdbc.update(
                """
                INSERT INTO rubric (id, course_id, name, description, created_by)
                VALUES (?::uuid, ?::uuid, 'Oral clarity', 'Default rubric for oral answers', ?::uuid)
                """,
                rubricId.toString(),
                id.toString(),
                createdBy
        );
        jdbc.update(
                """
                INSERT INTO rubric_criterion (id, rubric_id, name, description, max_points)
                VALUES (?::uuid, ?::uuid, 'Oral clarity', 'Answer is accurate, clear, and uses course terms.', 10)
                """,
                UUID.randomUUID().toString(),
                rubricId.toString()
        );
    }

    public void assignTeacher(String subjectId, String teacherId) {
        jdbc.update(
                """
                INSERT INTO course_assignment (course_id, teacher_id)
                VALUES (?::uuid, ?::uuid)
                ON CONFLICT DO NOTHING
                """,
                subjectId,
                teacherId
        );
    }

    public List<RubricItem> rubricsForTeacher(String teacherId) {
        return jdbc.query(
                """
                SELECT r.id::text, c.code || ' - ' || r.name, %s, %s, c.id::text
                FROM rubric r
                JOIN course c ON c.id = r.course_id
                JOIN course_assignment ca ON ca.course_id = c.id AND ca.teacher_id = ?::uuid
                ORDER BY c.code, r.name
                """.formatted(RUBRIC_CRITERIA, RUBRIC_MAX),
                (rs, row) -> new RubricItem(
                        rs.getString(1),
                        rs.getString(2),
                        rs.getString(3),
                        rs.getInt(4),
                        rs.getString(5)
                ),
                teacherId
        );
    }

    public boolean rubricBelongsToCourse(String rubricId, String courseId) {
        Integer count = jdbc.queryForObject(
                "SELECT count(*) FROM rubric WHERE id = ?::uuid AND course_id = ?::uuid",
                Integer.class,
                rubricId,
                courseId
        );
        return count != null && count > 0;
    }

    public boolean teacherOwnsRubric(String teacherId, String rubricId) {
        Integer count = jdbc.queryForObject(
                """
                SELECT count(*) FROM rubric r
                JOIN course_assignment ca ON ca.course_id = r.course_id AND ca.teacher_id = ?::uuid
                WHERE r.id = ?::uuid
                """,
                Integer.class,
                teacherId,
                rubricId
        );
        return count != null && count > 0;
    }

    public RubricDetailItem rubricDetail(String rubricId) {
        var header = jdbc.query(
                """
                SELECT r.id::text, r.name, COALESCE(r.description, ''), c.id::text, c.code, c.name
                FROM rubric r
                JOIN course c ON c.id = r.course_id
                WHERE r.id = ?::uuid
                """,
                (rs, row) -> new Object[] {
                        rs.getString(1),
                        rs.getString(2),
                        rs.getString(3),
                        rs.getString(4),
                        rs.getString(5),
                        rs.getString(6),
                },
                rubricId
        );
        if (header.isEmpty()) {
            return null;
        }
        Object[] values = header.getFirst();
        List<RubricCriterionItem> criteria = jdbc.query(
                """
                SELECT id::text, name, COALESCE(description, ''), max_points, sort_order
                FROM rubric_criterion
                WHERE rubric_id = ?::uuid
                ORDER BY sort_order, name
                """,
                (rs, row) -> new RubricCriterionItem(
                        rs.getString(1),
                        rs.getString(2),
                        rs.getString(3),
                        rs.getDouble(4),
                        rs.getInt(5)
                ),
                rubricId
        );
        int maxScore = criteria.stream().mapToInt(c -> (int) Math.round(c.maxPoints())).sum();
        return new RubricDetailItem(
                (String) values[0],
                (String) values[1],
                (String) values[2],
                (String) values[3],
                (String) values[4],
                (String) values[5],
                criteria,
                maxScore
        );
    }

    @Transactional
    public void updateRubric(String rubricId, String name, String description, List<RubricCriterionItem> criteria) {
        jdbc.update(
                "UPDATE rubric SET name = ?, description = ? WHERE id = ?::uuid",
                name.trim(),
                description == null ? "" : description.trim(),
                rubricId
        );
        jdbc.update("DELETE FROM rubric_criterion WHERE rubric_id = ?::uuid", rubricId);
        int order = 0;
        for (RubricCriterionItem criterion : criteria) {
            jdbc.update(
                    """
                    INSERT INTO rubric_criterion (id, rubric_id, name, description, max_points, sort_order)
                    VALUES (?::uuid, ?::uuid, ?, ?, ?, ?)
                    """,
                    criterion.id(),
                    rubricId,
                    criterion.name().trim(),
                    criterion.description() == null ? "" : criterion.description().trim(),
                    criterion.maxPoints(),
                    order++
            );
        }
    }

    public List<QuestionItem> questions(String status) {
        if (status == null || status.isBlank()) {
            return jdbc.query(QUESTION_SELECT + " ORDER BY q.created_at DESC", questionMapper());
        }
        return jdbc.query(QUESTION_SELECT + " WHERE q.status = ? ORDER BY q.created_at DESC", questionMapper(), status);
    }

    public void insertQuestion(
            UUID id,
            String subjectId,
            String topic,
            String prompt,
            String bloom,
            String rubricId,
            String status,
            String source,
            String authorId,
            String sourceRef,
            String generationId
    ) {
        jdbc.update(
                """
                INSERT INTO question
                    (id, course_id, topic, prompt, bloom_level, rubric_id, status, source, author_id,
                     source_ref, generation_id)
                VALUES (?::uuid, ?::uuid, ?, ?, ?, ?::uuid, ?, ?, ?::uuid, ?, ?::uuid)
                """,
                id.toString(),
                subjectId,
                topic,
                prompt,
                bloom,
                rubricId,
                status,
                source,
                authorId,
                sourceRef,
                generationId
        );
    }

    public void insertGenerationRequest(
            UUID id,
            String subjectId,
            String requestedBy,
            String topic,
            String bloom,
            int count,
            String modelName
    ) {
        jdbc.update(
                """
                INSERT INTO ai_generation_request
                    (id, course_id, requested_by, topic, bloom_level, question_count, model_name, status, completed_at)
                VALUES (?::uuid, ?::uuid, ?::uuid, ?, ?, ?, ?, 'COMPLETED', now())
                """,
                id.toString(),
                subjectId,
                requestedBy,
                topic,
                bloom,
                count,
                modelName
        );
    }

    public void updateQuestion(String id, String prompt, String bloom, String status, String reviewerId) {
        jdbc.update(
                """
                UPDATE question
                SET prompt = ?, bloom_level = ?, status = ?, reviewed_by = ?::uuid, reviewed_at = now(),
                    updated_at = now()
                WHERE id = ?::uuid
                """,
                prompt,
                bloom,
                status,
                reviewerId,
                id
        );
    }

    public QuestionItem question(String id) {
        List<QuestionItem> rows = jdbc.query(QUESTION_SELECT + " WHERE q.id = ?::uuid", questionMapper(), id);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public void insertExam(UUID id, String title, String format, String teacherId, String subjectId) {
        jdbc.update(
                """
                INSERT INTO exam_session (id, course_id, teacher_id, language_config_id, title, status, format)
                VALUES (
                    ?::uuid, ?::uuid, ?::uuid,
                    (SELECT id FROM language_config ORDER BY is_default DESC, code LIMIT 1),
                    ?, 'IN_PROGRESS', ?
                )
                """,
                id.toString(),
                subjectId,
                teacherId,
                title,
                format
        );
    }

    public void linkQuestion(String examId, String questionId) {
        jdbc.update(
                """
                INSERT INTO exam_session_question (session_id, question_id, sort_order)
                SELECT ?::uuid, ?::uuid, COALESCE(max(sort_order), 0) + 1
                FROM exam_session_question WHERE session_id = ?::uuid
                ON CONFLICT DO NOTHING
                """,
                examId,
                questionId,
                examId
        );
    }

    public List<SessionItem> sessionsForStudent(String studentId) {
        return jdbc.query(
                """
                SELECT e.id::text, e.title, e.format, e.status,
                       COALESCE(c.name, 'General'), COALESCE(t.full_name, 'Unassigned'),
                       a.id IS NOT NULL, a.score
                FROM exam_session e
                LEFT JOIN course c ON c.id = e.course_id
                LEFT JOIN "user" t ON t.id = e.teacher_id
                LEFT JOIN exam_attempt a ON a.session_id = e.id AND a.student_id = ?::uuid
                WHERE e.status = 'IN_PROGRESS'
                ORDER BY e.created_at DESC
                """,
                (rs, row) -> new SessionItem(
                        rs.getString(1),
                        rs.getString(2),
                        rs.getString(3),
                        rs.getString(4),
                        rs.getString(5),
                        rs.getString(6),
                        rs.getBoolean(7),
                        (Integer) rs.getObject(8)
                ),
                studentId
        );
    }

    public List<QuestionItem> questionsOnExam(String examId) {
        return jdbc.query(
                QUESTION_SELECT + """
                        JOIN exam_session_question esq ON esq.question_id = q.id
                        WHERE esq.session_id = ?::uuid
                        ORDER BY esq.sort_order
                        """,
                questionMapper(),
                examId
        );
    }

    public void enterExam(UUID attemptId, String examId, String studentId) {
        jdbc.update(
                """
                INSERT INTO exam_attempt (id, session_id, student_id)
                VALUES (?::uuid, ?::uuid, ?::uuid)
                ON CONFLICT (session_id, student_id) DO NOTHING
                """,
                attemptId.toString(),
                examId,
                studentId
        );
    }

    public List<AttemptItem> attemptsForTeacher(String teacherId) {
        return jdbc.query(
                ATTEMPT_SELECT + " WHERE e.teacher_id = ?::uuid ORDER BY a.started_at DESC",
                attemptMapper(),
                teacherId
        );
    }

    public List<AttemptItem> attemptsForStudent(String studentId) {
        return jdbc.query(
                ATTEMPT_SELECT + " WHERE a.student_id = ?::uuid ORDER BY a.started_at DESC",
                attemptMapper(),
                studentId
        );
    }

    public List<AttemptItem> allAttempts() {
        return jdbc.query(ATTEMPT_SELECT + " ORDER BY a.started_at DESC", attemptMapper());
    }

    public void setScore(String attemptId, String teacherId, int score) {
        jdbc.update(
                """
                UPDATE exam_attempt a
                SET score = ?
                FROM exam_session e
                WHERE a.id = ?::uuid AND a.session_id = e.id AND e.teacher_id = ?::uuid
                """,
                score,
                attemptId,
                teacherId
        );
    }

    public SpeechSettings speechSettings() {
        List<SpeechSettings> rows = jdbc.query(
                """
                SELECT stt_language, tts_language FROM language_config
                ORDER BY is_default DESC, code LIMIT 1
                """,
                (rs, row) -> new SpeechSettings(shortCode(rs.getString(1)), shortCode(rs.getString(2)))
        );
        return rows.isEmpty() ? new SpeechSettings("vi", "vi") : rows.getFirst();
    }

    @Transactional
    public void saveSpeech(String sttLanguage, String ttsLanguage) {
        String code = sttLanguage.equals(ttsLanguage) ? sttLanguage : sttLanguage + "-" + ttsLanguage;
        jdbc.update("UPDATE language_config SET is_default = false");
        jdbc.update(
                """
                INSERT INTO language_config (id, code, name, stt_language, tts_language, is_default)
                VALUES (?::uuid, ?, ?, ?, ?, true)
                ON CONFLICT (code) DO UPDATE SET is_default = true
                """,
                UUID.randomUUID().toString(),
                code,
                "STT " + sttLanguage + " / TTS " + ttsLanguage,
                LOCALES.getOrDefault(sttLanguage, sttLanguage),
                LOCALES.getOrDefault(ttsLanguage, ttsLanguage)
        );
    }

    public boolean teacherOwnsSubject(String teacherId, String subjectId) {
        Integer count = jdbc.queryForObject(
                """
                SELECT count(*) FROM course_assignment
                WHERE teacher_id = ?::uuid AND course_id = ?::uuid
                """,
                Integer.class,
                teacherId,
                subjectId
        );
        return count != null && count > 0;
    }

    public List<SubjectItem> subjectsForTeacher(String teacherId) {
        return jdbc.query(
                """
                SELECT c.id::text, c.code, c.name
                FROM course c
                JOIN course_assignment ca ON ca.course_id = c.id
                WHERE ca.teacher_id = ?::uuid
                ORDER BY c.code
                """,
                (rs, row) -> new SubjectItem(rs.getString(1), rs.getString(2), rs.getString(3), List.of(teacherId)),
                teacherId
        );
    }

    private static String shortCode(String locale) {
        int dash = locale.indexOf('-');
        return dash < 0 ? locale : locale.substring(0, dash);
    }

    private static RowMapper<QuestionItem> questionMapper() {
        return (rs, row) -> new QuestionItem(
                rs.getString(1),
                rs.getString(2),
                rs.getString(3),
                rs.getString(4),
                rs.getString(5),
                rs.getString(6),
                rs.getString(7),
                rs.getString(8),
                rs.getString(9),
                rs.getInt(10),
                rs.getString(11),
                rs.getString(12),
                rs.getString(13),
                rs.getString(14)
        );
    }

    private static RowMapper<AttemptItem> attemptMapper() {
        return (rs, row) -> new AttemptItem(
                rs.getString(1),
                rs.getString(2),
                rs.getString(3),
                rs.getString(4),
                rs.getString(5),
                (Integer) rs.getObject(6),
                rs.getString(7)
        );
    }
}
