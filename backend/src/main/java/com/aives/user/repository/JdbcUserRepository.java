package com.aives.user.repository;

import com.aives.user.dto.UserProfile;
import com.aives.user.model.Role;
import com.aives.user.model.UserAccount;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcUserRepository implements UserRepository {

    private static final RowMapper<UserAccount> USER = (rs, rowNum) -> map(rs);

    private static final String SELECT = """
            SELECT u.id::text AS id, u.email, u.full_name AS name, u.password_hash AS password,
                   r.code AS role, u.google_sub
            FROM "user" u
            JOIN role r ON r.id = u.role_id
            """;

    private final JdbcTemplate jdbc;

    public JdbcUserRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<UserAccount> findByEmail(String email) {
        return jdbc.query(SELECT + " WHERE u.email = ?", USER, email).stream().findFirst();
    }

    @Override
    public Optional<UserAccount> findById(String id) {
        return jdbc.query(SELECT + " WHERE u.id = ?::uuid", USER, id).stream().findFirst();
    }

    @Override
    public List<UserAccount> findAllOrdered() {
        return jdbc.query(
                SELECT + """
                        ORDER BY CASE r.code
                            WHEN 'STUDENT' THEN 0
                            WHEN 'EXAMINER' THEN 1
                            WHEN 'ADMIN' THEN 2
                            ELSE 3
                        END, u.full_name ASC
                        """,
                USER
        );
    }

    @Override
    public long countByRole(Role role) {
        Long count = jdbc.queryForObject(
                """
                SELECT count(*) FROM "user" u JOIN role r ON r.id = u.role_id WHERE r.code = ?
                """,
                Long.class,
                role.name()
        );
        return count == null ? 0 : count;
    }

    @Override
    public UserAccount updateRole(String id, Role role) {
        jdbc.update(
                """
                UPDATE "user"
                SET role_id = (SELECT id FROM role WHERE code = ?), updated_at = now()
                WHERE id = ?::uuid
                """,
                role.name(),
                id
        );
        return findById(id).orElseThrow();
    }

    @Override
    public Optional<UserProfile> findProfile(String id) {
        return jdbc.query(
                """
                SELECT u.id::text AS id, u.email, u.full_name, u.phone, u.student_code, r.code AS role
                FROM "user" u JOIN role r ON r.id = u.role_id
                WHERE u.id = ?::uuid
                """,
                (rs, rowNum) -> new UserProfile(
                        rs.getString("id"),
                        rs.getString("email"),
                        rs.getString("full_name"),
                        rs.getString("phone"),
                        rs.getString("student_code"),
                        Role.valueOf(rs.getString("role"))
                ),
                id
        ).stream().findFirst();
    }

    @Override
    public UserProfile updateProfile(String id, String name, String phone) {
        jdbc.update(
                """
                UPDATE "user" SET full_name = ?, phone = ?, updated_at = now() WHERE id = ?::uuid
                """,
                name,
                phone,
                id
        );
        return findProfile(id).orElseThrow();
    }

    @Override
    public void linkGoogleSubject(String id, String googleSub) {
        jdbc.update(
                """
                UPDATE "user"
                SET google_sub = ?, updated_at = now()
                WHERE id = ?::uuid AND google_sub IS NULL
                """,
                googleSub,
                id
        );
    }

    @Override
    public void insert(UserAccount user) {
        jdbc.update(
                """
                INSERT INTO "user" (id, email, password_hash, full_name, role_id, google_sub)
                VALUES (?::uuid, ?, ?, ?, (SELECT id FROM role WHERE code = ?), ?)
                """,
                user.id(),
                user.email(),
                user.passwordHash(),
                user.name(),
                user.role().name(),
                user.googleSub()
        );
    }

    private static UserAccount map(ResultSet rs) throws SQLException {
        return new UserAccount(
                rs.getString("id"),
                rs.getString("email"),
                rs.getString("name"),
                rs.getString("password"),
                Role.valueOf(rs.getString("role")),
                rs.getString("google_sub")
        );
    }
}
