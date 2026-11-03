package com.aives.student.dto;

import java.time.Instant;

public record StudentResponse(
        String id,
        String name,
        String email,
        String studentCode,
        String phone,
        boolean active,
        Instant createdAt
) {
}
