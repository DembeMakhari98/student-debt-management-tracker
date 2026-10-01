package com.adaptit.studentdebt.writeback;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import com.adaptit.studentdebt.domain.WriteBackAttempt;
import com.adaptit.studentdebt.domain.WriteBackStatus;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.WriteBackAttemptRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Pushes agent/officer {@link ActivityLogEntry} rows to ITS Integrator through {@link
 * ActivityLogWriteBackAdapter} (issue #3), retries recent failures, and never fails the caller
 * whose action triggered the entry — the same never-fail pattern as {@code
 * NightlyExtractService.runExtract()} (issue #2). Every attempt, success or failure, is recorded as
 * a {@link WriteBackAttempt} row so a failure is surfaced rather than silently dropped.
 */
@Service
public class ActivityLogWriteBackService {

    private static final Logger log = LoggerFactory.getLogger(ActivityLogWriteBackService.class);

    /** Matches the workflow config's {@code max_retries_per_stage: 3} — see the issue #3 spec's Open Questions. */
    static final int MAX_ATTEMPTS = 3;

    private final ActivityLogWriteBackAdapter adapter;
    private final ActivityLogEntryRepository activityLogEntryRepository;
    private final WriteBackAttemptRepository writeBackAttemptRepository;
    private final Clock clock;

    public ActivityLogWriteBackService(ActivityLogWriteBackAdapter adapter,
                                        ActivityLogEntryRepository activityLogEntryRepository,
                                        WriteBackAttemptRepository writeBackAttemptRepository,
                                        Clock clock) {
        this.adapter = adapter;
        this.activityLogEntryRepository = activityLogEntryRepository;
        this.writeBackAttemptRepository = writeBackAttemptRepository;
        this.clock = clock;
    }

    /**
     * Called by a producer (e.g. {@code DecisionService}, {@code ReminderCadenceService})
     * immediately after it saves a new {@link ActivityLogEntry}. Never throws — a write-back
     * failure must not fail the officer decision or reminder dispatch that triggered it.
     */
    @Transactional
    public void recordAndAttempt(ActivityLogEntry entry) {
        try {
            attempt(entry, 1);
        } catch (Exception ex) {
            log.error("Unexpected error recording write-back attempt for entry {}", entry.getId(), ex);
        }
    }

    /**
     * Retries entries whose latest attempt failed and hasn't exhausted {@link #MAX_ATTEMPTS}.
     * Runs every 15 minutes — frequent enough that a transient failure clears quickly, infrequent
     * enough not to hammer ITS Integrator once it's real.
     */
    @Scheduled(fixedRate = 15 * 60 * 1000)
    @Transactional
    public void retryFailedWriteBacks() {
        for (WriteBackAttempt latest : latestAttemptPerEntry()) {
            if (latest.getStatus() != WriteBackStatus.FAILED || latest.getAttemptNumber() >= MAX_ATTEMPTS) {
                continue;
            }
            activityLogEntryRepository.findById(latest.getActivityLogEntryId()).ifPresent(entry -> {
                try {
                    attempt(entry, latest.getAttemptNumber() + 1);
                } catch (Exception ex) {
                    log.error("Unexpected error retrying write-back for entry {}", entry.getId(), ex);
                }
            });
        }
    }

    /** Entries that have exhausted every retry — surfaced via GET /api/admin/writeback/failures. */
    public List<WriteBackAttempt> failures() {
        return latestAttemptPerEntry().stream()
                .filter(a -> a.getStatus() == WriteBackStatus.FAILED && a.getAttemptNumber() >= MAX_ATTEMPTS)
                .toList();
    }

    private void attempt(ActivityLogEntry entry, int attemptNumber) {
        WriteBackResult result = adapter.attemptWrite(entry);

        writeBackAttemptRepository.save(WriteBackAttempt.builder()
                .activityLogEntryId(entry.getId())
                .attemptNumber(attemptNumber)
                .status(result.success() ? WriteBackStatus.SUCCESS : WriteBackStatus.FAILED)
                .errorMessage(result.errorMessage())
                .attemptedAt(Instant.now(clock))
                .build());

        if (!result.success()) {
            log.warn("Write-back attempt {} failed for activity log entry {}: {}",
                    attemptNumber, entry.getId(), result.errorMessage());
        }
    }

    /** One row per activity_log_entry_id — whichever attempt has the highest attempt number. */
    private List<WriteBackAttempt> latestAttemptPerEntry() {
        Map<java.util.UUID, WriteBackAttempt> latestById = writeBackAttemptRepository.findAll().stream()
                .collect(Collectors.toMap(
                        WriteBackAttempt::getActivityLogEntryId,
                        a -> a,
                        (a, b) -> a.getAttemptNumber() >= b.getAttemptNumber() ? a : b));
        return latestById.values().stream()
                .sorted(Comparator.comparing(WriteBackAttempt::getAttemptedAt))
                .toList();
    }
}
