package com.adaptit.studentdebt.dto;

import java.time.Instant;
import java.util.UUID;

/** One activity-log entry whose write-back has exhausted every retry (issue #3). */
public record WriteBackFailureDto(
        UUID activityLogEntryId,
        String debtorKey,
        String text,
        int attemptCount,
        Instant lastAttemptedAt,
        String lastError
) {
}
