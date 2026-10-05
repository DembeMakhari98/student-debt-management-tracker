package com.adaptit.studentdebt.writeback;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import com.adaptit.studentdebt.domain.WriteBackStatus;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.WriteBackAttemptRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Full-stack proof of issue #3's retry/immutability requirements: a real H2-backed run
 * accumulates one write_back_attempt row per attempt and never updates an existing one,
 * mirroring {@code NightlyExtractIdempotencyTest}'s precedent (issue #2).
 */
@SpringBootTest
class WriteBackAttemptIntegrationTest {

    @Autowired
    private ActivityLogWriteBackService writeBackService;
    @Autowired
    private ActivityLogEntryRepository activityLogEntryRepository;
    @Autowired
    private WriteBackAttemptRepository writeBackAttemptRepository;

    @MockitoBean
    private ActivityLogWriteBackAdapter adapter;

    @Test
    void aFailureThenARetrySuccessLeavesTwoImmutableAttemptRowsNeverUpdatingTheFirst() {
        ActivityLogEntry entry = activityLogEntryRepository.save(ActivityLogEntry.builder()
                .debtorKey("STU-100234-2026")
                .text("Recommendation approved by Nomsa Mahlangu")
                .source("Officer decision · Nomsa Mahlangu")
                .createdAt(Instant.now())
                .build());

        when(adapter.attemptWrite(any())).thenReturn(WriteBackResult.failed("ITS Integrator unreachable"));
        writeBackService.recordAndAttempt(entry);

        var afterFirstAttempt = writeBackAttemptRepository
                .findAllByActivityLogEntryIdOrderByAttemptNumberDesc(entry.getId());
        assertThat(afterFirstAttempt).hasSize(1);
        assertThat(afterFirstAttempt.get(0).getAttemptNumber()).isEqualTo(1);
        assertThat(afterFirstAttempt.get(0).getStatus()).isEqualTo(WriteBackStatus.FAILED);
        var firstAttemptId = afterFirstAttempt.get(0).getId();

        when(adapter.attemptWrite(any())).thenReturn(WriteBackResult.ok());
        writeBackService.retryFailedWriteBacks();

        var afterRetry = writeBackAttemptRepository
                .findAllByActivityLogEntryIdOrderByAttemptNumberDesc(entry.getId());
        assertThat(afterRetry).hasSize(2);
        assertThat(afterRetry.get(0).getAttemptNumber()).isEqualTo(2);
        assertThat(afterRetry.get(0).getStatus()).isEqualTo(WriteBackStatus.SUCCESS);

        // The original failed row is untouched — a retry inserts, it never updates.
        var originalRow = afterRetry.stream().filter(a -> a.getId().equals(firstAttemptId)).findFirst().orElseThrow();
        assertThat(originalRow.getAttemptNumber()).isEqualTo(1);
        assertThat(originalRow.getStatus()).isEqualTo(WriteBackStatus.FAILED);

        assertThat(writeBackService.failures()).isEmpty();
    }
}
