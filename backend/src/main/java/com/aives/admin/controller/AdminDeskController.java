package com.aives.admin.controller;

import com.aives.admin.service.AdminDeskService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

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

import com.aives.admin.repository.AdminExamRepository.AdminExamItem;
import com.aives.teaching.dto.DeskRecords.AttemptItem;
import com.aives.teaching.dto.DeskRecords.SpeechSettings;
import com.aives.teaching.dto.DeskRecords.SubjectItem;
import com.aives.user.dto.PublicUser;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/admin")
public class AdminDeskController {

    private final AdminDeskService desk;

    public AdminDeskController(AdminDeskService desk) {
        this.desk = desk;
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
        desk.createSubject(admin, request.code(), request.name());
    }

    @PostMapping("/subjects/teachers")
    public void assign(@Valid @RequestBody AssignTeacherRequest request) {
        desk.assignTeacher(request.subjectId(), request.teacherId());
    }

    @DeleteMapping("/subjects/{subjectId}/teachers/{teacherId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unassign(@PathVariable UUID subjectId, @PathVariable UUID teacherId) {
        desk.unassignTeacher(subjectId, teacherId);
    }

    @PatchMapping("/subjects/{id}")
    public SubjectItem updateSubject(@PathVariable UUID id, @Valid @RequestBody SubjectRequest request) {
        return desk.updateSubject(id, request.code(), request.name());
    }

    @DeleteMapping("/subjects/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSubject(@PathVariable UUID id) {
        desk.deleteSubject(id);
    }

    @GetMapping("/exams")
    public List<AdminExamItem> exams(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID subjectId,
            @RequestParam(required = false) OffsetDateTime from,
            @RequestParam(required = false) OffsetDateTime to
    ) {
        return desk.exams(status, subjectId, from, to);
    }

    @GetMapping("/exams/{id}")
    public AdminExamItem exam(@PathVariable UUID id) {
        return desk.exam(id);
    }

    @PatchMapping("/exams/{id}/schedule")
    public AdminExamItem reschedule(@PathVariable UUID id, @Valid @RequestBody ScheduleRequest request) {
        return desk.reschedule(id, request.scheduledAt(), request.durationMinutes());
    }

    @PatchMapping("/exams/{id}/status")
    public AdminExamItem setExamStatus(@PathVariable UUID id, @Valid @RequestBody ExamStatusRequest request) {
        return desk.setExamStatus(id, request.status());
    }

    @GetMapping("/performance")
    public List<AttemptItem> performance() {
        return desk.performance();
    }

    @GetMapping("/speech")
    public SpeechSettings speech() {
        return desk.speech();
    }

    @PatchMapping("/speech")
    public SpeechSettings saveSpeech(@Valid @RequestBody SpeechRequest request) {
        return desk.saveSpeech(request.sttLanguage(), request.ttsLanguage(), request.ttsVoice(), request.ttsVoiceEn());
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
