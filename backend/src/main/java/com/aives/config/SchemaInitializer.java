package com.aives.config;

import jakarta.annotation.PostConstruct;
import javax.sql.DataSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

/**
 * Applies schema + demo seed exactly once per Postgres volume.
 * Registered accounts and teacher-created data are preserved across API restarts.
 * Wiping the Docker volume ({@code docker compose down -v}) is the only routine that clears them.
 */
@Component
public class SchemaInitializer {

    private static final String SEED_KEY = "seed_applied";

    private final DataSource dataSource;
    private final JdbcTemplate jdbc;

    public SchemaInitializer(DataSource dataSource, JdbcTemplate jdbc) {
        this.dataSource = dataSource;
        this.jdbc = jdbc;
    }

    @PostConstruct
    void init() {
        ensureMetaTable();
        boolean userTableExists = relationExists("public.\"user\"");

        if (!userTableExists) {
            new ResourceDatabasePopulator(
                    new ClassPathResource("schema.sql"),
                    new ClassPathResource("seed.sql")
            ).execute(dataSource);
            markSeeded();
            return;
        }

        // Existing volume: never drop users. Seed demo rows only if never marked and bank is empty.
        if (!isSeeded()) {
            if (!hasAnyQuestions()) {
                new ResourceDatabasePopulator(new ClassPathResource("seed.sql")).execute(dataSource);
            }
            markSeeded();
        }
    }

    private void ensureMetaTable() {
        jdbc.execute(
                """
                CREATE TABLE IF NOT EXISTS app_meta (
                  key text PRIMARY KEY,
                  value text NOT NULL,
                  updated_at timestamptz NOT NULL DEFAULT now()
                )
                """
        );
    }

    private boolean relationExists(String regclassArg) {
        String existing = jdbc.queryForObject("SELECT to_regclass(?)::text", String.class, regclassArg);
        return existing != null;
    }

    private boolean hasAnyQuestions() {
        if (!relationExists("public.question")) {
            return false;
        }
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM question", Integer.class);
        return count != null && count > 0;
    }

    private boolean isSeeded() {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM app_meta WHERE key = ?",
                Integer.class,
                SEED_KEY
        );
        return count != null && count > 0;
    }

    private void markSeeded() {
        jdbc.update(
                """
                INSERT INTO app_meta (key, value) VALUES (?, 'true')
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
                """,
                SEED_KEY
        );
    }
}
