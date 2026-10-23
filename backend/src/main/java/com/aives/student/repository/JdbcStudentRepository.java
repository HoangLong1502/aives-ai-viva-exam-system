package com.aives.student.repository;

import com.aives.student.model.Student;
import com.aives.student.model.StudentSort;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcStudentRepository implements StudentRepository {

    private static final RowMapper<Student> STUDENT = (rs, rowNum) -> map(rs);

    private static final String FROM = """
            FROM "user" u
            JOIN role r ON r.id = u.role_id AND r.code = 'STUDENT'
            """;

    private static final String SELECT = """
            SELECT u.id::text AS id, u.full_name, u.email, u.student_code, u.phone,
                   u.is_active, u.created_at
            """ + FROM;

    private static final String FILTER = """
             WHERE (u.full_name ILIKE ? ESCAPE '\\' OR u.email ILIKE ? ESCAPE '\\'
                    OR u.student_code ILIKE ? ESCAPE '\\')
            """;

    private final JdbcTemplate jdbc;

    public JdbcStudentRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<Student> search(String query, StudentSort sort, boolean ascending, int limit, int offset) {
        String order = " ORDER BY " + sort.column() + (ascending ? " ASC" : " DESC")
                + " NULLS LAST, u.id ASC LIMIT ? OFFSET ?";
        if (query == null) {
            return jdbc.query(SELECT + order, STUDENT, limit, offset);
        }
        String pattern = pattern(query);
        return jdbc.query(SELECT + FILTER + order, STUDENT, pattern, pattern, pattern, limit, offset);
    }

    @Override
    public long count(String query) {
        Long total;
        if (query == null) {
            total = jdbc.queryForObject("SELECT count(*) " + FROM, Long.class);
        } else {
            String pattern = pattern(query);
            total = jdbc.queryForObject("SELECT count(*) " + FROM + FILTER, Long.class, pattern, pattern, pattern);
        }
        return total == null ? 0 : total;
    }

    @Override
    public Optional<Student> findById(String id) {
        return jdbc.query(SELECT + " WHERE u.id = ?::uuid", STUDENT, id).stream().findFirst();
    }

    @Override
    public boolean emailTaken(String email, String exceptId) {
        return exists("SELECT 1 FROM \"user\" WHERE lower(email) = lower(?)", email, exceptId);
    }

    @Override
    public boolean studentCodeTaken(String studentCode, String exceptId) {
        return exists("SELECT 1 FROM \"user\" WHERE upper(student_code) = upper(?)", studentCode, exceptId);
    }

    @Override
    public void insert(Student student, String passwordHash) {
        jdbc.update(
                """
                INSERT INTO "user" (id, email, password_hash, full_name, student_code, phone, role_id, is_active)
                VALUES (?::uuid, ?, ?, ?, ?, ?, (SELECT id FROM role WHERE code = 'STUDENT'), ?)
                """,
                student.id(),
                student.email(),
                passwordHash,
                student.name(),
                student.studentCode(),
                student.phone(),
                student.active()
        );
    }

    @Override
    public void update(Student student) {
        jdbc.update(
                """
                UPDATE "user"
                SET full_name = ?, email = ?, student_code = ?, phone = ?, is_active = ?, updated_at = now()
                WHERE id = ?::uuid
                  AND role_id = (SELECT id FROM role WHERE code = 'STUDENT')
                """,
                student.name(),
                student.email(),
                student.studentCode(),
                student.phone(),
                student.active(),
                student.id()
        );
    }

    @Override
    public boolean hasDependents(String id) {
        Boolean found = jdbc.queryForObject(
                """
                SELECT EXISTS (SELECT 1 FROM enrollment WHERE student_id = ?::uuid)
                    OR EXISTS (SELECT 1 FROM exam_attempt WHERE student_id = ?::uuid)
                """,
                Boolean.class,
                id,
                id
        );
        return Boolean.TRUE.equals(found);
    }

    @Override
    public void delete(String id) {
        jdbc.update(
                """
                DELETE FROM "user"
                WHERE id = ?::uuid
                  AND role_id = (SELECT id FROM role WHERE code = 'STUDENT')
                """,
                id
        );
    }

    private boolean exists(String sql, String value, String exceptId) {
        if (exceptId == null) {
            return !jdbc.queryForList(sql, value).isEmpty();
        }
        return !jdbc.queryForList(sql + " AND id <> ?::uuid", value, exceptId).isEmpty();
    }

    private static String pattern(String query) {
        String escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }

    private static Student map(ResultSet rs) throws SQLException {
        return new Student(
                rs.getString("id"),
                rs.getString("full_name"),
                rs.getString("email"),
                rs.getString("student_code"),
                rs.getString("phone"),
                rs.getBoolean("is_active"),
                rs.getObject("created_at", OffsetDateTime.class).toInstant()
        );
    }
}
