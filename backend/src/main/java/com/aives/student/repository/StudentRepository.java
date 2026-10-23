package com.aives.student.repository;

import com.aives.student.model.Student;
import com.aives.student.model.StudentSort;
import java.util.List;
import java.util.Optional;

public interface StudentRepository {

    List<Student> search(String query, StudentSort sort, boolean ascending, int limit, int offset);

    long count(String query);

    Optional<Student> findById(String id);

    boolean emailTaken(String email, String exceptId);

    boolean studentCodeTaken(String studentCode, String exceptId);

    void insert(Student student, String passwordHash);

    void update(Student student);

    boolean hasDependents(String id);

    void delete(String id);
}
