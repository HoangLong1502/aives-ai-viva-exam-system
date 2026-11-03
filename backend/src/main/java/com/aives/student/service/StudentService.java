package com.aives.student.service;

import com.aives.student.model.Student;
import com.aives.student.model.StudentPage;
import com.aives.student.model.StudentSort;
import com.aives.student.repository.StudentRepository;
import com.aives.web.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class StudentService {

    static final int MAX_PAGE_SIZE = 100;

    private final StudentRepository students;
    private final PasswordEncoder passwordEncoder;

    public StudentService(StudentRepository students, PasswordEncoder passwordEncoder) {
        this.students = students;
        this.passwordEncoder = passwordEncoder;
    }

    public StudentPage list(int page, int size, String sort, String direction, String query) {
        if (page < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "page must not be negative");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "size must be between 1 and " + MAX_PAGE_SIZE);
        }
        StudentSort studentSort = StudentSort.fromKey(sort).orElseThrow(() ->
                new ApiException(HttpStatus.BAD_REQUEST, "sort must be one of name, code, email, createdAt"));
        boolean ascending = switch (direction.toLowerCase(Locale.ROOT)) {
            case "asc" -> true;
            case "desc" -> false;
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "dir must be asc or desc");
        };
        String needle = query == null || query.isBlank() ? null : query.trim();
        long offset = (long) page * size;
        if (offset > Integer.MAX_VALUE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "page is out of range");
        }
        List<Student> items = students.search(needle, studentSort, ascending, size, (int) offset);
        return new StudentPage(items, page, size, students.count(needle));
    }

    public Student get(String id) {
        return students.findById(id).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "Student not found"));
    }

    public Student create(String name, String email, String studentCode, String password, String phone) {
        Student student = new Student(
                UUID.randomUUID().toString(),
                name.trim(),
                normalizeEmail(email),
                normalizeCode(studentCode),
                normalizePhone(phone),
                true,
                Instant.now()
        );
        requireUnique(student, null);
        try {
            students.insert(student, passwordEncoder.encode(password));
        } catch (DuplicateKeyException exception) {
            throw duplicate(exception);
        }
        return get(student.id());
    }

    public Student update(
            String id,
            String name,
            String email,
            String studentCode,
            String phone,
            boolean active
    ) {
        Student current = get(id);
        Student next = new Student(
                current.id(),
                name.trim(),
                normalizeEmail(email),
                normalizeCode(studentCode),
                normalizePhone(phone),
                active,
                current.createdAt()
        );
        requireUnique(next, id);
        try {
            students.update(next);
        } catch (DuplicateKeyException exception) {
            throw duplicate(exception);
        }
        return get(id);
    }

    public void delete(String id) {
        get(id);
        if (students.hasDependents(id)) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Student has enrollments or exam attempts and cannot be deleted; deactivate the student instead"
            );
        }
        students.delete(id);
    }

    private void requireUnique(Student student, String exceptId) {
        if (students.emailTaken(student.email(), exceptId)) {
            throw new ApiException(HttpStatus.CONFLICT, "Email is already in use");
        }
        if (students.studentCodeTaken(student.studentCode(), exceptId)) {
            throw new ApiException(HttpStatus.CONFLICT, "Student code is already in use");
        }
    }

    private static ApiException duplicate(DuplicateKeyException exception) {
        String detail = String.valueOf(exception.getMessage());
        String message = detail.contains("student_code")
                ? "Student code is already in use"
                : "Email is already in use";
        return new ApiException(HttpStatus.CONFLICT, message);
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeCode(String studentCode) {
        return studentCode.trim().toUpperCase(Locale.ROOT);
    }

    private static String normalizePhone(String phone) {
        if (phone == null || phone.isBlank()) {
            return null;
        }
        return phone.trim();
    }
}
