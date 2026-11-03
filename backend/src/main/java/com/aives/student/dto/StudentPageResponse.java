package com.aives.student.dto;

import java.util.List;

public record StudentPageResponse(
        List<StudentResponse> items,
        int page,
        int size,
        long totalItems,
        int totalPages
) {
}
