package com.aives.admin.repository;

import java.util.HashMap;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Repository;

@Repository
public class AdminStatsRepository {

    private final JdbcTemplate jdbc;

    public AdminStatsRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Number of users per role code. */
    public Map<String, Long> userCountsByRole() {
        return counts(
                """
                SELECT r.code AS key, count(*) AS total
                FROM "user" u
                JOIN role r ON r.id = u.role_id
                GROUP BY r.code
                """
        );
    }

    /** Number of exam sessions keyed by "FORMAT:STATUS". */
    public Map<String, Long> examCountsByFormatAndStatus() {
        return counts(
                """
                SELECT format || ':' || status AS key, count(*) AS total
                FROM exam_session
                GROUP BY format, status
                """
        );
    }

    private Map<String, Long> counts(String sql) {
        Map<String, Long> counts = new HashMap<>();
        jdbc.query(sql, (RowCallbackHandler) rs ->
                counts.put(rs.getString("key"), rs.getLong("total")));
        return counts;
    }
}
