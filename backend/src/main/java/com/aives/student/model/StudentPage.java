package com.aives.student.model;

import java.util.List;

public record StudentPage(List<Student> items, int page, int size, long totalItems) {

    public int totalPages() {
        return (int) ((totalItems + size - 1) / size);
    }
}
