package com.aives.student.mapper;

import com.aives.student.dto.StudentPageResponse;
import com.aives.student.dto.StudentResponse;
import com.aives.student.model.Student;
import com.aives.student.model.StudentPage;

public final class StudentMapper {

    private StudentMapper() {
    }

    public static StudentResponse toResponse(Student student) {
        return new StudentResponse(
                student.id(),
                student.name(),
                student.email(),
                student.studentCode(),
                student.phone(),
                student.active(),
                student.createdAt()
        );
    }

    public static StudentPageResponse toResponse(StudentPage page) {
        return new StudentPageResponse(
                page.items().stream().map(StudentMapper::toResponse).toList(),
                page.page(),
                page.size(),
                page.totalItems(),
                page.totalPages()
        );
    }
}
