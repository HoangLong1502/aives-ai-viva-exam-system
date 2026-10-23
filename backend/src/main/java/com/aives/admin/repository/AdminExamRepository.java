package com.aives.admin.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AdminExamRepository {

    private static final String EXAM_SELECT = """
            SELECT e.id::text, e.title, e.format, e.status,
                   e.course_id::text, COALESCE(c.code, ''), COALESCE(c.name, ''),
                   e.teacher_id::text, COALESCE(t.full_name, ''),
                   e.scheduled_at, e.duration_minutes,
                   (SELECT count(*) FROM exam_session_question esq WHERE esq.session_id = e.id)::int,
                   (SELECT count(*) FROM exam_attempt a WHERE a.session_id = e.id)::int,
                   e.created_at
            FROM exam_session e
            LEFT JOIN course c ON c.id = e.course_id
            LEFT JOIN "user" t ON t.id = e.teacher_id
            """;

    private final JdbcTemplate jdbc;

    public AdminExamRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<AdminExamItem> exams(String status, String subjectId, OffsetDateTime from, OffsetDateTime to) {
        StringBuilder sql = new StringBuilder(EXAM_SELECT).append(" WHERE 1 = 1");
        List<Object> args = new ArrayList<>();
        if (status != null) {
            sql.append(" AND e.status = ?");
            args.add(status);
        }
        if (subjectId != null) {
            sql.append(" AND e.course_id = ?::uuid");
            args.add(subjectId);
        }
        if (from != null) {
            sql.append(" AND e.scheduled_at >= ?");
            args.add(Timestamp.from(from.toInstant()));
        }
        if (to != null) {
            sql.append(" AND e.scheduled_at < ?");
            args.add(Timestamp.from(to.toInstant()));
        }
        sql.append(" ORDER BY e.scheduled_at ASC NULLS LAST, e.created_at DESC");
        return jdbc.query(sql.toString(), (rs, row) -> map(rs), args.toArray());
    }

    public AdminExamItem exam(String id) {
        List<AdminExamItem> rows = jdbc.query(EXAM_SELECT + " WHERE e.id = ?::uuid", (rs, row) -> map(rs), id);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    public int reschedule(String id, OffsetDateTime scheduledAt, Integer durationMinutes) {
        return jdbc.update(
                "UPDATE exam_session SET scheduled_at = ?, duration_minutes = ? WHERE id = ?::uuid",
                scheduledAt == null ? null : Timestamp.from(scheduledAt.toInstant()),
                durationMinutes,
                id
        );
    }

    public int setStatus(String id, String status) {
        return jdbc.update("UPDATE exam_session SET status = ? WHERE id = ?::uuid", status, id);
    }

    private static AdminExamItem map(ResultSet rs) throws SQLException {
        Timestamp scheduledAt = rs.getTimestamp(10);
        Timestamp createdAt = rs.getTimestamp(14);
        return new AdminExamItem(
                rs.getString(1),
                rs.getString(2),
                rs.getString(3),
                rs.getString(4),
                rs.getString(5),
                rs.getString(6),
                rs.getString(7),
                rs.getString(8),
                rs.getString(9),
                scheduledAt == null ? null : scheduledAt.toInstant().toString(),
                (Integer) rs.getObject(11),
                rs.getInt(12),
                rs.getInt(13),
                createdAt == null ? null : createdAt.toInstant().toString()
        );
    }

    public record AdminExamItem(
            String id,
            String title,
            String format,
            String status,
            String subjectId,
            String subjectCode,
            String subjectName,
            String teacherId,
            String teacherName,
            String scheduledAt,
            Integer durationMinutes,
            int questionCount,
            int attemptCount,
            String createdAt
    ) {
    }
}
