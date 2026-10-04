package com.aives.admin;

import java.util.HashMap;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;

@Service
public class AdminStatsService {

    private final JdbcTemplate jdbc;

    public AdminStatsService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public AdminStats snapshot() {
        Map<String, Long> roles = counts(
                """
                SELECT r.code AS key, count(*) AS total
                FROM app_user u
                JOIN role r ON r.id = u.role_id
                GROUP BY r.code
                """
        );
        Map<String, Long> exams = counts(
                """
                SELECT format || ':' || status AS key, count(*) AS total
                FROM exam_session
                GROUP BY format, status
                """
        );
        return new AdminStats(
                roles.getOrDefault("STUDENT", 0L),
                roles.getOrDefault("EXAMINER", 0L),
                roles.getOrDefault("ADMIN", 0L),
                exams.getOrDefault("MULTIPLE_CHOICE:IN_PROGRESS", 0L),
                exams.getOrDefault("ORAL:IN_PROGRESS", 0L),
                exams.getOrDefault("MULTIPLE_CHOICE:SCHEDULED", 0L),
                exams.getOrDefault("ORAL:SCHEDULED", 0L),
                exams.getOrDefault("MULTIPLE_CHOICE:COMPLETED", 0L),
                exams.getOrDefault("ORAL:COMPLETED", 0L)
        );
    }

    private Map<String, Long> counts(String sql) {
        Map<String, Long> counts = new HashMap<>();
        jdbc.query(sql, (RowCallbackHandler) rs ->
                counts.put(rs.getString("key"), rs.getLong("total")));
        return counts;
    }
}
