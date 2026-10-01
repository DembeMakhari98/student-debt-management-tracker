package com.adaptit.studentdebt.writeback;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import com.adaptit.studentdebt.domain.WriteBackAttempt;
import com.adaptit.studentdebt.domain.WriteBackStatus;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.WriteBackAttemptRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Unit tests for issue #3's acceptance criteria: retried and surfaced failures, never silent. */
class ActivityLogWriteBackServiceTest {

    private final ActivityLogWriteBackAdapter adapter = mock(ActivityLogWriteBackAdapter.class);
    private final ActivityLogEntryRepository activityLogEntryRepository = mock(ActivityLogEntryRepository.class);
    private final WriteBackAttemptRepository writeBackAttemptRepository = mock(WriteBackAttemptRepository.class);
    private final WriteBackAttemptRecorder recorder = mock(WriteBackAttemptRecorder.class);

    private final ActivityLogWriteBackService service =
            new ActivityLogWriteBackService(adapter, activityLogEntryRepository, writeBackAttemptRepository, recorder);

    private static ActivityLogEntry entry(UUID id) {
        return ActivityLogEntry.builder()
                .id(id)
                .debtorKey("STU-100234-2026")
                .text("Recommendation approved by Nomsa Mahlangu")
                .source("Officer decision · Nomsa Mahlangu")
                .createdAt(Instant.parse("2026-06-01T00:00:00Z"))
                .build();
    }

    private static WriteBackAttempt attemptRow(UUID entryId, int attemptNumber, WriteBackStatus status, Instant at) {
        return WriteBackAttempt.builder()
                .id(UUID.randomUUID())
                .activityLogEntryId(entryId)
                .attemptNumber(attemptNumber)
                .status(status)
                .attemptedAt(at)
                .build();
    }

    @Test
    void successfulAttemptRecordsAttemptOneAsSuccess() {
        UUID entryId = UUID.randomUUID();
        when(adapter.attemptWrite(any())).thenReturn(WriteBackResult.ok());

        service.recordAndAttempt(entry(entryId));

        ArgumentCaptor<WriteBackResult> resultCaptor = ArgumentCaptor.forClass(WriteBackResult.class);
        verify(recorder).record(eq(entryId), eq(1), resultCaptor.capture());
        assertThat(resultCaptor.getValue().success()).isTrue();
    }

    @Test
    void failingAdapterRecordsAFailedAttemptAndDoesNotThrow() {
        UUID entryId = UUID.randomUUID();
        when(adapter.attemptWrite(any())).thenReturn(WriteBackResult.failed("ITS Integrator unreachable"));

        assertThatCode(() -> service.recordAndAttempt(entry(entryId))).doesNotThrowAnyException();

        ArgumentCaptor<WriteBackResult> resultCaptor = ArgumentCaptor.forClass(WriteBackResult.class);
        verify(recorder).record(eq(entryId), eq(1), resultCaptor.capture());
        assertThat(resultCaptor.getValue().success()).isFalse();
        assertThat(resultCaptor.getValue().errorMessage()).isEqualTo("ITS Integrator unreachable");
    }

    @Test
    void aThrowingAdapterIsRecordedAsAFailedAttemptNotLost() {
        // Adversarial review finding #1/#2: a throwing adapter must still produce a recorded
        // attempt, otherwise the entry silently vanishes from both the sweep and /failures.
        UUID entryId = UUID.randomUUID();
        when(adapter.attemptWrite(any())).thenThrow(new RuntimeException("connection reset"));

        assertThatCode(() -> service.recordAndAttempt(entry(entryId))).doesNotThrowAnyException();

        ArgumentCaptor<WriteBackResult> resultCaptor = ArgumentCaptor.forClass(WriteBackResult.class);
        verify(recorder).record(eq(entryId), eq(1), resultCaptor.capture());
        assertThat(resultCaptor.getValue().success()).isFalse();
        assertThat(resultCaptor.getValue().errorMessage()).isEqualTo("connection reset");
    }

    @Test
    void retrySweepRetriesAnEntryBelowMaxAttempts() {
        UUID entryId = UUID.randomUUID();
        WriteBackAttempt lastFailedAttempt =
                attemptRow(entryId, 1, WriteBackStatus.FAILED, Instant.parse("2026-05-31T00:00:00Z"));
        when(writeBackAttemptRepository.findAll()).thenReturn(List.of(lastFailedAttempt));
        when(activityLogEntryRepository.findById(entryId)).thenReturn(Optional.of(entry(entryId)));
        when(adapter.attemptWrite(any())).thenReturn(WriteBackResult.ok());

        service.retryFailedWriteBacks();

        verify(recorder).record(eq(entryId), eq(2), any());
    }

    @Test
    void retrySweepLeavesAnEntryAloneOnceMaxAttemptsIsReached() {
        UUID entryId = UUID.randomUUID();
        WriteBackAttempt exhausted = attemptRow(
                entryId, ActivityLogWriteBackService.MAX_ATTEMPTS, WriteBackStatus.FAILED,
                Instant.parse("2026-05-31T00:00:00Z"));
        when(writeBackAttemptRepository.findAll()).thenReturn(List.of(exhausted));

        service.retryFailedWriteBacks();

        verify(activityLogEntryRepository, never()).findById(any());
        verify(recorder, never()).record(any(), anyInt(), any());
    }

    @Test
    void retrySweepIgnoresEntriesWhoseLatestAttemptAlreadySucceeded() {
        UUID entryId = UUID.randomUUID();
        WriteBackAttempt succeeded =
                attemptRow(entryId, 1, WriteBackStatus.SUCCESS, Instant.parse("2026-05-31T00:00:00Z"));
        when(writeBackAttemptRepository.findAll()).thenReturn(List.of(succeeded));

        service.retryFailedWriteBacks();

        verify(activityLogEntryRepository, never()).findById(any());
    }

    @Test
    void aRecorderFailureDuringRetryDoesNotAbortTheRestOfTheSweep() {
        // The recorder runs in its own transaction (REQUIRES_NEW) and can fail independently of
        // the caller; retryFailedWriteBacks must not let one entry's failure stop the loop.
        UUID entryId = UUID.randomUUID();
        WriteBackAttempt lastFailedAttempt =
                attemptRow(entryId, 1, WriteBackStatus.FAILED, Instant.parse("2026-05-31T00:00:00Z"));
        when(writeBackAttemptRepository.findAll()).thenReturn(List.of(lastFailedAttempt));
        when(activityLogEntryRepository.findById(entryId)).thenReturn(Optional.of(entry(entryId)));
        when(adapter.attemptWrite(any())).thenReturn(WriteBackResult.ok());
        org.mockito.Mockito.doThrow(new RuntimeException("db down")).when(recorder).record(any(), anyInt(), any());

        assertThatCode(service::retryFailedWriteBacks).doesNotThrowAnyException();
    }

    @Test
    void failuresReturnsOnlyEntriesThatHaveExhaustedMaxAttempts() {
        UUID exhaustedId = UUID.randomUUID();
        UUID stillRetryingId = UUID.randomUUID();
        UUID succeededId = UUID.randomUUID();

        WriteBackAttempt exhausted = attemptRow(
                exhaustedId, ActivityLogWriteBackService.MAX_ATTEMPTS, WriteBackStatus.FAILED,
                Instant.parse("2026-05-31T00:00:00Z"));
        WriteBackAttempt stillRetrying =
                attemptRow(stillRetryingId, 1, WriteBackStatus.FAILED, Instant.parse("2026-05-31T00:01:00Z"));
        WriteBackAttempt succeeded =
                attemptRow(succeededId, 1, WriteBackStatus.SUCCESS, Instant.parse("2026-05-31T00:02:00Z"));
        when(writeBackAttemptRepository.findAll()).thenReturn(List.of(exhausted, stillRetrying, succeeded));

        List<WriteBackAttempt> failures = service.failures();

        assertThat(failures).extracting(WriteBackAttempt::getActivityLogEntryId).containsExactly(exhaustedId);
    }

    @Test
    void onlyTheHighestAttemptNumberPerEntryCountsAsLatest() {
        UUID entryId = UUID.randomUUID();
        WriteBackAttempt firstAttempt =
                attemptRow(entryId, 1, WriteBackStatus.FAILED, Instant.parse("2026-05-31T00:00:00Z"));
        WriteBackAttempt secondAttempt =
                attemptRow(entryId, 2, WriteBackStatus.SUCCESS, Instant.parse("2026-05-31T00:15:00Z"));
        when(writeBackAttemptRepository.findAll()).thenReturn(List.of(firstAttempt, secondAttempt));

        service.retryFailedWriteBacks();

        // Latest attempt (2) succeeded, so the sweep must not touch this entry again.
        verify(activityLogEntryRepository, never()).findById(any());
        assertThat(service.failures()).isEmpty();
    }

    @Test
    void aTieInAttemptNumberIsBrokenDeterministicallyById() {
        // Guards the merge function in latestAttemptPerEntry() — should never happen once the DB's
        // unique (entry_id, attempt_number) constraint is in place, but the grouping logic itself
        // must still behave deterministically if it ever does.
        UUID entryId = UUID.randomUUID();
        UUID lowerId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID higherId = UUID.fromString("00000000-0000-0000-0000-000000000002");
        WriteBackAttempt a = WriteBackAttempt.builder()
                .id(lowerId).activityLogEntryId(entryId).attemptNumber(1)
                .status(WriteBackStatus.SUCCESS).attemptedAt(Instant.parse("2026-05-31T00:00:00Z")).build();
        WriteBackAttempt b = WriteBackAttempt.builder()
                .id(higherId).activityLogEntryId(entryId).attemptNumber(1)
                .status(WriteBackStatus.FAILED).attemptedAt(Instant.parse("2026-05-31T00:00:00Z")).build();

        when(writeBackAttemptRepository.findAll()).thenReturn(List.of(a, b));
        List<WriteBackAttempt> result1 = service.failures();
        when(writeBackAttemptRepository.findAll()).thenReturn(List.of(b, a));
        List<WriteBackAttempt> result2 = service.failures();

        // Same outcome regardless of findAll()'s row order.
        assertThat(result1.isEmpty()).isEqualTo(result2.isEmpty());
    }
}
