package com.aives.student.controller;

import com.aives.student.dto.StudentPageResponse;
import com.aives.student.dto.StudentResponse;
import com.aives.student.mapper.StudentMapper;
import com.aives.student.service.StudentService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/students")
public class StudentController {

    static final String CODE_PATTERN = "^[A-Za-z0-9]{3,50}$";
    static final String PHONE_PATTERN = "^\\+?[0-9]{8,15}$";

    private final StudentService students;

    public StudentController(StudentService students) {
        this.students = students;
    }

    @GetMapping
    public StudentPageResponse list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "name") String sort,
            @RequestParam(defaultValue = "asc") String dir,
            @RequestParam(required = false) String q
    ) {
        return StudentMapper.toResponse(students.list(page, size, sort, dir, q));
    }

    @GetMapping("/{id}")
    public StudentResponse get(@PathVariable UUID id) {
        return StudentMapper.toResponse(students.get(id.toString()));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StudentResponse create(@Valid @RequestBody CreateStudentRequest request) {
        return StudentMapper.toResponse(students.create(
                request.name(),
                request.email(),
                request.studentCode(),
                request.password(),
                request.phone()
        ));
    }

    @PutMapping("/{id}")
    public StudentResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateStudentRequest request) {
        return StudentMapper.toResponse(students.update(
                id.toString(),
                request.name(),
                request.email(),
                request.studentCode(),
                request.phone(),
                request.active()
        ));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        students.delete(id.toString());
    }

    public record CreateStudentRequest(
            @NotBlank(message = "must not be blank") @Size(max = 255, message = "must be at most 255 characters") String name,
            @NotBlank(message = "must not be blank") @Email(message = "must be a valid email") @Size(max = 255, message = "must be at most 255 characters") String email,
            @NotBlank(message = "must not be blank") @Pattern(regexp = CODE_PATTERN, message = "must be 3 to 50 letters or digits") String studentCode,
            @NotBlank(message = "must not be blank") @Size(min = 8, max = 72, message = "must be 8 to 72 characters") String password,
            @Pattern(regexp = PHONE_PATTERN, message = "must be 8 to 15 digits with an optional leading +") String phone
    ) {
    }

    public record UpdateStudentRequest(
            @NotBlank(message = "must not be blank") @Size(max = 255, message = "must be at most 255 characters") String name,
            @NotBlank(message = "must not be blank") @Email(message = "must be a valid email") @Size(max = 255, message = "must be at most 255 characters") String email,
            @NotBlank(message = "must not be blank") @Pattern(regexp = CODE_PATTERN, message = "must be 3 to 50 letters or digits") String studentCode,
            @Pattern(regexp = PHONE_PATTERN, message = "must be 8 to 15 digits with an optional leading +") String phone,
            @NotNull(message = "must not be null") Boolean active
    ) {
    }
}
