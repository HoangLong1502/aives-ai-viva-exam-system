package com.aives.admin.service;

import com.aives.admin.dto.AdminStats;
import com.aives.admin.repository.AdminStatsRepository;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class AdminStatsService {

    private final AdminStatsRepository repository;

    public AdminStatsService(AdminStatsRepository repository) {
        this.repository = repository;
    }

    public AdminStats snapshot() {
        Map<String, Long> roles = repository.userCountsByRole();
        Map<String, Long> exams = repository.examCountsByFormatAndStatus();
        return new AdminStats(
                roles.getOrDefault("STUDENT", 0L),
                roles.getOrDefault("EXAMINER", 0L),
                roles.getOrDefault("ADMIN", 0L),
                exams.getOrDefault("MULTIPLE_CHOICE:IN_PROGRESS", 0L),
                exams.getOrDefault("ORAL:IN_PROGRESS", 0L),
                exams.getOrDefault("MULTIPLE_CHOICE:SCHEDULED", 0L),
                exams.getOrDefault("ORAL:SCHEDULED", 0L),
                exams.getOrDefault("MULTIPLE_CHOICE:COMPLETED", 0L),
                exams.getOrDefault("ORAL:COMPLETED", 0L)
        );
    }
}
