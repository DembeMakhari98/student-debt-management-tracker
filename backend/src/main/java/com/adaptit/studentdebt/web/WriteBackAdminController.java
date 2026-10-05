package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import com.adaptit.studentdebt.domain.WriteBackAttempt;
import com.adaptit.studentdebt.dto.WriteBackFailureDto;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.writeback.ActivityLogWriteBackService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Surfaces activity-log entries whose write-back to ITS Integrator has exhausted every retry
 * (issue #3) — "retried and surfaced, not silently dropped." Mirrors {@code
 * AdminExtractController}'s shape from issue #2.
 */
@RestController
public class WriteBackAdminController {

    private final ActivityLogWriteBackService writeBackService;
    private final ActivityLogEntryRepository activityLogEntryRepository;

    public WriteBackAdminController(ActivityLogWriteBackService writeBackService,
                                     ActivityLogEntryRepository activityLogEntryRepository) {
        this.writeBackService = writeBackService;
        this.activityLogEntryRepository = activityLogEntryRepository;
    }

    @GetMapping("/api/admin/writeback/failures")
    public List<WriteBackFailureDto> failures() {
        return writeBackService.failures().stream()
                .map(this::toDto)
                .toList();
    }

    private WriteBackFailureDto toDto(WriteBackAttempt attempt) {
        ActivityLogEntry entry = activityLogEntryRepository.findById(attempt.getActivityLogEntryId()).orElse(null);
        return new WriteBackFailureDto(
                attempt.getActivityLogEntryId(),
                entry != null ? entry.getDebtorKey() : null,
                entry != null ? entry.getText() : null,
                attempt.getAttemptNumber(),
                attempt.getAttemptedAt(),
                attempt.getErrorMessage());
    }
}
