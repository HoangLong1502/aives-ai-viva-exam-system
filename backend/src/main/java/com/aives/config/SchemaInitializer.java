package com.aives.config;

import jakarta.annotation.PostConstruct;
import javax.sql.DataSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

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
        applySchema();
        ensureMetaTable();
        if (isSeeded()) {
            return;
        }
        if (!hasAnyQuestions()) {
            new ResourceDatabasePopulator(new ClassPathResource("seed.sql")).execute(dataSource);
        }
        markSeeded();
    }

    private void applySchema() {
        String existing = jdbc.queryForObject("SELECT to_regclass('public.question')::text", String.class);
        String script = existing == null ? "schema.sql" : "schema-upgrade.sql";
        new ResourceDatabasePopulator(new ClassPathResource(script)).execute(dataSource);
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

    private boolean hasAnyQuestions() {
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
