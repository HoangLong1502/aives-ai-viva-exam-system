package com.aives.config;

import javax.sql.DataSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;

@Component
public class SchemaInitializer {

    private final DataSource dataSource;
    private final JdbcTemplate jdbc;

    public SchemaInitializer(DataSource dataSource, JdbcTemplate jdbc) {
        this.dataSource = dataSource;
        this.jdbc = jdbc;
    }

    @PostConstruct
    void init() {
        String existing = jdbc.queryForObject("SELECT to_regclass('public.\"user\"')::text", String.class);
        if (existing != null) {
            return;
        }
        new ResourceDatabasePopulator(new ClassPathResource("schema.sql"), new ClassPathResource("seed.sql")).execute(dataSource);
    }
}
