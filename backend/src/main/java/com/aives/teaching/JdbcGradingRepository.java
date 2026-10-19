package com.aives.teaching;

import com.aives.teaching.GradingRecords.CourseGradingItem;
import com.aives.teaching.GradingRecords.ExamGradingItem;

import com.aives.teaching.GradingRecords.ParticipantItem;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Read and write model for the teacher's course -> exam -> participant -> answer grading flow. */
@Repository
public class JdbcGradingRepository {

    /** An attempt still needs the teacher when it is submitted and has an answer without a teacher mark. */
    private static final String ATTEMPT_PENDING = """
            (a.status = 'SUBMITTED' AND EXISTS (
                SELECT 1 FROM question_turn qt JOIN answer ans ON ans.turn_id = qt.id
                WHERE qt.attempt_id = a.id AND ans.teacher_score IS NULL))
            """;

    /** Exam and course names for an attempt the teacher owns. */
    public record AttemptHeader(
            String attemptId,
            String examId,
            String examTitle,
            String courseId,
            String courseName,
            String studentName,
            String studentCode,
            String status,
            Integer score
    ) {
    }

    /** A turn with the question it belongs to and the teacher mark stored on its answer. */
    public record TurnRow(
            String questionId,
            String turnId,
            int turnNo,
            String turnType,
            String questionText,
            boolean answered,
            String transcript,
            Double aiScore,
            String aiFeedback,
            String evaluator,
            Double teacherScore,
            String teacherFeedback
    ) {
    }

    private final JdbcTemplate jdbc;

    public JdbcGradingRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<CourseGradingItem> courses(String teacherId) {
        return jdbc.query(
                """
                SELECT c.id::text, c.code, c.name,
                       count(DISTINCT e.id)::int,
                       count(a.id) FILTER (WHERE a.status = 'SUBMITTED')::int,
                       count(a.id) FILTER (WHERE %s)::int
                FROM course_assignment ca
                JOIN course c ON c.id = ca.course_id
                LEFT JOIN exam_session e ON e.course_id = c.id AND e.teacher_id = ca.teacher_id
                LEFT JOIN exam_attempt a ON a.session_id = e.id
                WHERE ca.teacher_id = ?::uuid
                GROUP BY c.id, c.code, c.name
                ORDER BY c.name
                """.formatted(ATTEMPT_PENDING),
                (rs, row) -> new CourseGradingItem(
                        rs.getString(1), rs.getString(2), rs.getString(3),
                        rs.getInt(4), rs.getInt(5), rs.getInt(6)),
                teacherId
        );
    }

    public boolean teacherOwnsCourse(String teacherId, String courseId) {
        Integer count = jdbc.queryForObject(
                "SELECT count(*) FROM course_assignment WHERE teacher_id = ?::uuid AND course_id = ?::uuid",
                Integer.class,
                teacherId,
                courseId
        );
        return count != null && count > 0;
    }

    public List<ExamGradingItem> examsInCourse(String teacherId, String courseId) {
        return jdbc.query(
                """
                SELECT e.id::text, e.title, e.status, e.format,
                       count(a.id)::int,
                       count(a.id) FILTER (WHERE a.status = 'SUBMITTED')::int,
                       count(a.id) FILTER (WHERE %s)::int,
                       avg(a.score) FILTER (WHERE a.status = 'SUBMITTED')::float8
                FROM exam_session e
                LEFT JOIN exam_attempt a ON a.session_id = e.id
                WHERE e.teacher_id = ?::uuid AND e.course_id = ?::uuid
                GROUP BY e.id, e.title, e.status, e.format, e.created_at
                ORDER BY e.created_at DESC
                """.formatted(ATTEMPT_PENDING),
                (rs, row) -> new ExamGradingItem(
                        rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getInt(5), rs.getInt(6), rs.getInt(7), (Double) rs.getObject(8)),
                teacherId,
                courseId
        );
    }

    /** Title, course id and course name of an exam the teacher owns, or null. */
    public String[] examHeader(String teacherId, String examId) {
        List<String[]> rows = jdbc.query(
                """
                SELECT e.title, e.course_id::text, COALESCE(c.name, '')
                FROM exam_session e
                LEFT JOIN course c ON c.id = e.course_id
                WHERE e.id = ?::uuid AND e.teacher_id = ?::uuid
                """,
                (rs, row) -> new String[] {rs.getString(1), rs.getString(2), rs.getString(3)},
                examId,
                teacherId
        );
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public List<ParticipantItem> participants(String examId) {
        return jdbc.query(
                """
                SELECT a.id::text, s.id::text, s.full_name, COALESCE(s.student_code, ''), a.status, a.score,
                       (SELECT count(DISTINCT qt.question_id) FROM question_turn qt JOIN answer ans ON ans.turn_id = qt.id
                         WHERE qt.attempt_id = a.id)::int,
                       (SELECT count(DISTINCT qt.question_id) FROM question_turn qt JOIN answer ans ON ans.turn_id = qt.id
                         WHERE qt.attempt_id = a.id AND ans.teacher_score IS NOT NULL)::int
                FROM exam_attempt a
                JOIN "user" s ON s.id = a.student_id
                WHERE a.session_id = ?::uuid
                ORDER BY s.full_name
                """,
                (rs, row) -> new ParticipantItem(
                        rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getString(5), (Integer) rs.getObject(6), rs.getInt(7), rs.getInt(8)),
                examId
        );
    }

    public AttemptHeader attemptHeader(String teacherId, String attemptId) {
        List<AttemptHeader> rows = jdbc.query(
                """
                SELECT a.id::text, e.id::text, e.title, e.course_id::text, COALESCE(c.name, ''),
                       s.full_name, COALESCE(s.student_code, ''), a.status, a.score
                FROM exam_attempt a
                JOIN exam_session e ON e.id = a.session_id
                JOIN "user" s ON s.id = a.student_id
                LEFT JOIN course c ON c.id = e.course_id
                WHERE a.id = ?::uuid AND e.teacher_id = ?::uuid
                """,
                (rs, row) -> new AttemptHeader(
                        rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5),
                        rs.getString(6), rs.getString(7), rs.getString(8), (Integer) rs.getObject(9)),
                attemptId,
                teacherId
        );
        return rows.isEmpty() ? null : rows.getFirst();
    }

    /** Every asked turn of the attempt in order; turns the student never answered have no answer row. */
    public List<TurnRow> turns(String attemptId) {
        return jdbc.query(
                """
                SELECT qt.question_id::text, qt.id::text, qt.turn_no, qt.turn_type, qt.question_text,
                       ans.id IS NOT NULL, COALESCE(ans.transcript, ''),
                       ans.score::float8, ans.feedback, ans.evaluator,
                       ans.teacher_score::float8, ans.teacher_feedback
                FROM question_turn qt
                LEFT JOIN answer ans ON ans.turn_id = qt.id
                WHERE qt.attempt_id = ?::uuid
                ORDER BY qt.turn_no
                """,
                (rs, row) -> new TurnRow(
                        rs.getString(1), rs.getString(2), rs.getInt(3), rs.getString(4), rs.getString(5),
                        rs.getBoolean(6), rs.getString(7),
                        (Double) rs.getObject(8), rs.getString(9), rs.getString(10),
                        (Double) rs.getObject(11), rs.getString(12)),
                attemptId
        );
    }

    /**
     * Stores the teacher's mark (as a percent of the question's points) on every answered turn of one
     * question, so the question counts as graded as a whole. Returns how many answers were marked.
     */
    public int saveTeacherMark(String attemptId, String questionId, String teacherId, double percent, String feedback) {
        return jdbc.update(
                """
                UPDATE answer ans
                SET teacher_score = ?, teacher_feedback = ?, graded_by = ?::uuid, graded_at = now()
                FROM question_turn qt
                WHERE qt.id = ans.turn_id AND qt.attempt_id = ?::uuid AND qt.question_id = ?::uuid
                """,
                percent,
                feedback,
                teacherId,
                attemptId,
                questionId
        );
    }

    public void updateAttemptScore(String attemptId, int score) {
        jdbc.update("UPDATE exam_attempt SET score = ? WHERE id = ?::uuid", score, attemptId);
    }
}
