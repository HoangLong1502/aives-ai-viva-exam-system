package com.aives.student.model;

import java.util.Optional;

public enum StudentSort {
    NAME("name", "lower(u.full_name)"),
    CODE("code", "u.student_code"),
    EMAIL("email", "u.email"),
    CREATED_AT("createdAt", "u.created_at");

    private final String key;
    private final String column;

    StudentSort(String key, String column) {
        this.key = key;
        this.column = column;
    }

    public String column() {
        return column;
    }

    public static Optional<StudentSort> fromKey(String key) {
        for (StudentSort sort : values()) {
            if (sort.key.equals(key)) {
                return Optional.of(sort);
            }
        }
        return Optional.empty();
    }
}
