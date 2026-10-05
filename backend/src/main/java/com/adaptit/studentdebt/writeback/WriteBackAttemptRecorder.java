package com.adaptit.studentdebt.writeback;

import com.adaptit.studentdebt.domain.WriteBackAttempt;
import com.adaptit.studentdebt.domain.WriteBackStatus;
import com.adaptit.studentdebt.repository.WriteBackAttemptRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/**
 * Persists one {@link WriteBackAttempt} row in its own transaction (issue #3 adversarial review
 * finding #3). A separate bean, not a private method on {@code ActivityLogWriteBackService},
 * because {@code REQUIRES_NEW} only takes effect across a real Spring proxy boundary — calling it
 * from within the same class (self-invocation) would silently stay in the caller's transaction.
 * This guarantees a DB-level failure while recording an attempt can never roll back the officer
 * decision or reminder dispatch that triggered it.
 */
@Service
public class WriteBackAttemptRecorder {

    private final WriteBackAttemptRepository writeBackAttemptRepository;
    private final Clock clock;

    public WriteBackAttemptRecorder(WriteBackAttemptRepository writeBackAttemptRepository, Clock clock) {
        this.writeBackAttemptRepository = writeBackAttemptRepository;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public WriteBackAttempt record(UUID activityLogEntryId, int attemptNumber, WriteBackResult result) {
        return writeBackAttemptRepository.save(WriteBackAttempt.builder()
                .activityLogEntryId(activityLogEntryId)
                .attemptNumber(attemptNumber)
                .status(result.success() ? WriteBackStatus.SUCCESS : WriteBackStatus.FAILED)
                .errorMessage(result.errorMessage())
                .attemptedAt(Instant.now(clock))
                .build());
    }
}
