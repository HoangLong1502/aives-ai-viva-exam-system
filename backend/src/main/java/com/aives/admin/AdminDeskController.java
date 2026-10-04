package com.aives.admin;

import com.aives.teaching.DeskRecords.AttemptItem;
import com.aives.teaching.DeskRecords.SpeechSettings;
import com.aives.teaching.DeskRecords.SubjectItem;
import com.aives.teaching.JdbcDeskRepository;
import com.aives.user.PublicUser;
import com.aives.user.Role;
import com.aives.user.UserRepository;
import com.aives.web.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminDeskController {

    private static final Set<String> LANGUAGES = Set.of("vi", "en");

    private final JdbcDeskRepository desk;
    private final UserRepository users;

    public AdminDeskController(JdbcDeskRepository desk, UserRepository users) {
        this.desk = desk;
        this.users = users;
    }

    @GetMapping("/subjects")
    public List<SubjectItem> subjects() {
        return desk.subjects();
    }

    @PostMapping("/subjects")
    public void createSubject(
            @AuthenticationPrincipal PublicUser admin,
            @Valid @RequestBody SubjectRequest request
    ) {
        desk.insertSubject(UUID.randomUUID(), request.code().trim(), request.name().trim(), admin.id());
    }

    @PostMapping("/subjects/teachers")
    public void assign(@Valid @RequestBody AssignTeacherRequest request) {
        var teacher = users.findById(request.teacherId()).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "Teacher not found"));
        if (teacher.role() != Role.EXAMINER) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only a teacher can be assigned to a subject");
        }
        desk.assignTeacher(request.subjectId(), request.teacherId());
    }

    @GetMapping("/performance")
    public List<AttemptItem> performance() {
        return desk.allAttempts();
    }

    @GetMapping("/speech")
    public SpeechSettings speech() {
        return desk.speechSettings();
    }

    @PatchMapping("/speech")
    public SpeechSettings saveSpeech(@Valid @RequestBody SpeechRequest request) {
        if (!LANGUAGES.contains(request.sttLanguage()) || !LANGUAGES.contains(request.ttsLanguage())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Language must be vi or en");
        }
        desk.saveSpeech(request.sttLanguage(), request.ttsLanguage());
        return desk.speechSettings();
    }

    public record SubjectRequest(@NotBlank String code, @NotBlank String name) {
    }

    public record AssignTeacherRequest(@NotBlank String subjectId, @NotBlank String teacherId) {
    }

    public record SpeechRequest(@NotBlank String sttLanguage, @NotBlank String ttsLanguage) {
    }
}
