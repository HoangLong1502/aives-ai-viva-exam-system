package com.aives.admin.service;

import com.aives.admin.repository.AdminExamRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.aives.admin.repository.AdminExamRepository.AdminExamItem;
import com.aives.teaching.dto.DeskRecords.AttemptItem;
import com.aives.teaching.dto.DeskRecords.SpeechSettings;
import com.aives.teaching.dto.DeskRecords.SubjectItem;
import com.aives.teaching.repository.JdbcDeskRepository;
import com.aives.user.dto.PublicUser;
import com.aives.user.model.Role;
import com.aives.user.repository.UserRepository;
import com.aives.web.ApiException;

@Service
public class AdminDeskService {

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

    public AdminDeskService(JdbcDeskRepository desk, AdminExamRepository exams, UserRepository users) {
        this.desk = desk;
        this.exams = exams;
        this.users = users;
    }

    public List<SubjectItem> subjects() {
        return desk.subjects();
    }

    public void createSubject(PublicUser admin, String code, String name) {
        desk.insertSubject(UUID.randomUUID(), code.trim(), name.trim(), admin.id());
    }

    public void assignTeacher(String subjectId, String teacherId) {
        var teacher = users.findById(teacherId).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "Teacher not found"));
        if (teacher.role() != Role.EXAMINER) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only a teacher can be assigned to a subject");
        }
        desk.assignTeacher(subjectId, teacherId);
    }

    public void unassignTeacher(UUID subjectId, UUID teacherId) {
        if (desk.unassignTeacher(subjectId.toString(), teacherId.toString()) == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "That teacher is not assigned to this subject");
        }
    }

    public SubjectItem updateSubject(UUID id, String code, String name) {
        int updated;
        try {
            updated = desk.updateSubject(id.toString(), code.trim(), name.trim());
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

    public void deleteSubject(UUID id) {
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

    public List<AdminExamItem> exams(String status, UUID subjectId, OffsetDateTime from, OffsetDateTime to) {
        String normalized = status == null || status.isBlank() ? null : status.trim().toUpperCase();
        if (normalized != null && !EXAM_STATUSES.contains(normalized)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown exam status");
        }
        return exams.exams(normalized, subjectId == null ? null : subjectId.toString(), from, to);
    }

    public AdminExamItem exam(UUID id) {
        AdminExamItem exam = exams.exam(id.toString());
        if (exam == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Exam not found");
        }
        return exam;
    }

    public AdminExamItem reschedule(UUID id, OffsetDateTime scheduledAt, Integer durationMinutes) {
        exam(id);
        exams.reschedule(id.toString(), scheduledAt, durationMinutes);
        return exam(id);
    }

    public AdminExamItem setExamStatus(UUID id, String requestedStatus) {
        String status = requestedStatus.trim().toUpperCase();
        if (!EXAM_STATUSES.contains(status)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown exam status");
        }
        exam(id);
        exams.setStatus(id.toString(), status);
        return exam(id);
    }

    public List<AttemptItem> performance() {
        return desk.allAttempts();
    }

    public SpeechSettings speech() {
        return desk.speechSettings();
    }

    public SpeechSettings saveSpeech(String sttLanguage, String ttsLanguage, String ttsVoice, String ttsVoiceEn) {
        if (!LANGUAGES.contains(sttLanguage) || !LANGUAGES.contains(ttsLanguage)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Language must be vi or en");
        }
        String voice = ttsVoice == null || ttsVoice.isBlank() ? "maichi" : ttsVoice.trim();
        String voiceEn = ttsVoiceEn == null || ttsVoiceEn.isBlank() ? "maichi" : ttsVoiceEn.trim();
        if (!TTS_VOICES_VI.contains(voice)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unsupported Vietnamese TTS voice");
        }
        if (!TTS_VOICES_EN.contains(voiceEn)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Unsupported English TTS voice");
        }
        desk.saveSpeech(sttLanguage, ttsLanguage, voice, voiceEn);
        return desk.speechSettings();
    }
}
