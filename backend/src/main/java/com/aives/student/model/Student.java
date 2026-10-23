package com.aives.student.model;

import java.time.Instant;

public record Student(
        String id,
        String name,
        String email,
        String studentCode,
        String phone,
        boolean active,
        Instant createdAt
) {
}
