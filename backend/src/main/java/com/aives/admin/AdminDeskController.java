package com.aives.admin;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.aives.admin.AdminExamRepository.AdminExamItem;
import com.aives.teaching.DeskRecords.AttemptItem;
import com.aives.teaching.DeskRecords.SpeechSettings;
import com.aives.teaching.DeskRecords.SubjectItem;
import com.aives.teaching.JdbcDeskRepository;
import com.aives.user.PublicUser;
import com.aives.user.Role;
import com.aives.user.UserRepository;
import com.aives.web.ApiException;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/admin")
public class AdminDeskController {

    private static final Set<String> LANGUAGES = Set.of("vi", "en");
    private static final Set<String> TTS_VOICES_VI = Set.of(
            "maichi", "giahuy", "baotrang", "kimoanh", "hamy", "huuduc", "quangminh", "tiendat"
    );
    /** ZeroTTS Vietnamese latents (cross-lingual English) plus browser fallbacks. */
    private static final Set<String> TTS_VOICES_EN = Set.of(
            "maichi", "giahuy", "baotrang", "kimoanh", "hamy", "huuduc", "quangminh", "tiendat",
            "google-en-us", "google-en-gb", "microsoft-en-us", "browser-en-us"
    );
    private static final Set<String> EXAM_STATUSES = Set.of("DRAFT", "PUBLISHED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED");

    private final JdbcDeskRepository desk;
    private final AdminExamRepository exams;
    private final UserRepository users;

    public AdminDeskController(JdbcDeskRepository desk, AdminExamRepository exams, UserRepository users) {
        this.desk = desk;
        this.exams = exams;
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

    @DeleteMapping("/subjects/{subjectId}/teachers/{teacherId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unassign(@PathVariable UUID subjectId, @PathVariable UUID teacherId) {
        if (desk.unassignTeacher(subjectId.toString(), teacherId.toString()) == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "That teacher is not assigned to this subject");
        }
    }

    @PatchMapping("/subjects/{id}")
    public SubjectItem updateSubject(@PathVariable UUID id, @Valid @RequestBody SubjectRequest request) {
        int updated;
        try {
            updated = desk.updateSubject(id.toString(), request.code().trim(), request.name().trim());
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "Another subject already uses that code");
        }
        if (updated == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Subject not found");
        }
        return desk.subjects().stream()
                .filter(subject -> subject.id().equals(id.toString()))
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Subject not found"));
    }

    @DeleteMapping("/subjects/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSubject(@PathVariable UUID id) {
        if (desk.subjectUsage(id.toString()) > 0) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "This subject already has exams, questions, materials, or enrollments, so it cannot be deleted"
            );
        }
        if (desk.deleteSubject(id.toString()) == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Subject not found");
        }
    }

    @GetMapping("/exams")
    public List<AdminExamItem> exams(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID subjectId,
            @RequestParam(required = false) OffsetDateTime from,
            @RequestParam(required = false) OffsetDateTime to
    ) {
        String normalized = status == null || status.isBlank() ? null : status.trim().toUpperCase();
        if (normalized != null && !EXAM_STATUSES.contains(normalized)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown exam status");
        }
        return exams.exams(normalized, subjectId == null ? null : subjectId.toString(), from, to);
    }

    @GetMapping("/exams/{id}")
    public AdminExamItem exam(@PathVariable UUID id) {
        return requireExam(id);
    }

    @PatchMapping("/exams/{id}/schedule")
    public AdminExamItem reschedule(@PathVariable UUID id, @Valid @RequestBody ScheduleRequest request) {
        requireExam(id);
        exams.reschedule(id.toString(), request.scheduledAt(), request.durationMinutes());
        return requireExam(id);
    }

    @PatchMapping("/exams/{id}/status")
    public AdminExamItem setExamStatus(@PathVariable UUID id, @Valid @RequestBody ExamStatusRequest request) {
        String status = request.status().trim().toUpperCase();
        if (!EXAM_STATUSES.contains(status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown exam status");
        }
        requireExam(id);
        exams.setStatus(id.toString(), status);
        return requireExam(id);
    }

    private AdminExamItem requireExam(UUID id) {
        AdminExamItem exam = exams.exam(id.toString());
        if (exam == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Exam not found");
        }
        return exam;
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
        String voice = request.ttsVoice() == null || request.ttsVoice().isBlank()
                ? "maichi"
                : request.ttsVoice().trim();
        String voiceEn = request.ttsVoiceEn() == null || request.ttsVoiceEn().isBlank()
                ? "maichi"
                : request.ttsVoiceEn().trim();
        if (!TTS_VOICES_VI.contains(voice)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unsupported Vietnamese TTS voice");
        }
        if (!TTS_VOICES_EN.contains(voiceEn)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unsupported English TTS voice");
        }
        desk.saveSpeech(request.sttLanguage(), request.ttsLanguage(), voice, voiceEn);
        return desk.speechSettings();
    }

    public record SubjectRequest(
            @NotBlank @Size(max = 50) String code,
            @NotBlank @Size(max = 255) String name
    ) {
    }

    public record ScheduleRequest(OffsetDateTime scheduledAt, @Min(1) @Max(600) Integer durationMinutes) {
    }

    public record ExamStatusRequest(@NotBlank String status) {
    }

    public record AssignTeacherRequest(@NotBlank String subjectId, @NotBlank String teacherId) {
    }

    public record SpeechRequest(
            @NotBlank String sttLanguage,
            @NotBlank String ttsLanguage,
            String ttsVoice,
            String ttsVoiceEn
    ) {
    }
}
