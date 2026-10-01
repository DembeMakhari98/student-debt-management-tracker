package com.adaptit.studentdebt.writeback;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import com.adaptit.studentdebt.domain.WriteBackAttempt;
import com.adaptit.studentdebt.domain.WriteBackStatus;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.WriteBackAttemptRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Unit tests for issue #3's acceptance criteria: retried and surfaced failures, never silent. */
class ActivityLogWriteBackServiceTest {

    private final ActivityLogWriteBackAdapter adapter = mock(ActivityLogWriteBackAdapter.class);
    private final ActivityLogEntryRepository activityLogEntryRepository = mock(ActivityLogEntryRepository.class);
    private final WriteBackAttemptRepository writeBackAttemptRepository = mock(WriteBackAttemptRepository.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-06-01T00:00:00Z"), ZoneOffset.UTC);

    private final ActivityLogWriteBackService service =
            new ActivityLogWriteBackService(adapter, activityLogEntryRepository, writeBackAttemptRepository, clock);

    private static ActivityLogEntry entry(UUID id) {
        return ActivityLogEntry.builder()
                .id(id)
                .debtorKey("STU-100234-2026")
                .text("Recommendation approved by Nomsa Mahlangu")
                .source("Officer decision · Nomsa Mahlangu")
                .createdAt(Instant.parse("2026-06-01T00:00:00Z"))
                .build();
    }

    @Test
    void successfulAttemptPersistsOneSuccessRow() {
        UUID entryId = UUID.randomUUID();
        when(adapter.attemptWrite(any())).thenReturn(WriteBackResult.ok());

        service.recordAndAttempt(entry(entryId));

        ArgumentCaptor<WriteBackAttempt> captor = ArgumentCaptor.forClass(WriteBackAttempt.class);
        verify(writeBackAttemptRepository).save(captor.capture());
        WriteBackAttempt saved = captor.getValue();
        assertThat(saved.getActivityLogEntryId()).isEqualTo(entryId);
        assertThat(saved.getAttemptNumber()).isEqualTo(1);
        assertThat(saved.getStatus()).isEqualTo(WriteBackStatus.SUCCESS);
        assertThat(saved.getErrorMessage()).isNull();
    }

    @Test
    void failingAdapterPersistsAFailedRowAndDoesNotThrow() {
        UUID entryId = UUID.randomUUID();
        when(adapter.attemptWrite(any())).thenReturn(WriteBackResult.failed("ITS Integrator unreachable"));

        assertThatCode(() -> service.recordAndAttempt(entry(entryId))).doesNotThrowAnyException();

        ArgumentCaptor<WriteBackAttempt> captor = ArgumentCaptor.forClass(WriteBackAttempt.class);
        verify(writeBackAttemptRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(WriteBackStatus.FAILED);
        assertThat(captor.getValue().getErrorMessage()).isEqualTo("ITS Integrator unreachable");
    }

    @Test
    void aThrowingAdapterIsCaughtAndNeverPropagates() {
        when(adapter.attemptWrite(any())).thenThrow(new RuntimeException("boom"));

        assertThatCode(() -> service.recordAndAttempt(entry(UUID.randomUUID()))).doesNotThrowAnyException();
    }

    @Test
    void retrySweepRetriesAnEntryBelowMaxAttempts() {
        UUID entryId = UUID.randomUUID();
        WriteBackAttempt lastFailedAttempt = WriteBackAttempt.builder()
                .id(UUID.randomUUID())
                .activityLogEntryId(entryId)
                .attemptNumber(1)
                .status(WriteBackStatus.FAILED)
                .attemptedAt(Instant.parse("2026-05-31T00:00:00Z"))
                .build();
        when(writeBackAttemptRepository.findAll()).thenReturn(List.of(lastFailedAttempt));
        when(activityLogEntryRepository.findById(entryId)).thenReturn(Optional.of(entry(entryId)));
        when(adapter.attemptWrite(any())).thenReturn(WriteBackResult.ok());

        service.retryFailedWriteBacks();

        ArgumentCaptor<WriteBackAttempt> captor = ArgumentCaptor.forClass(WriteBackAttempt.class);
        verify(writeBackAttemptRepository).save(captor.capture());
        assertThat(captor.getValue().getAttemptNumber()).isEqualTo(2);
        assertThat(captor.getValue().getStatus()).isEqualTo(WriteBackStatus.SUCCESS);
    }

    @Test
    void retrySweepLeavesAnEntryAloneOnceMaxAttemptsIsReached() {
        UUID entryId = UUID.randomUUID();
        WriteBackAttempt exhausted = WriteBackAttempt.builder()
                .id(UUID.randomUUID())
                .activityLogEntryId(entryId)
                .attemptNumber(ActivityLogWriteBackService.MAX_ATTEMPTS)
                .status(WriteBackStatus.FAILED)
                .attemptedAt(Instant.parse("2026-05-31T00:00:00Z"))
                .build();
        when(writeBackAttemptRepository.findAll()).thenReturn(List.of(exhausted));

        service.retryFailedWriteBacks();

        verify(activityLogEntryRepository, never()).findById(any());
        verify(writeBackAttemptRepository, never()).save(any());
    }

    @Test
    void retrySweepIgnoresEntriesWhoseLatestAttemptAlreadySucceeded() {
        UUID entryId = UUID.randomUUID();
        WriteBackAttempt succeeded = WriteBackAttempt.builder()
                .id(UUID.randomUUID())
                .activityLogEntryId(entryId)
                .attemptNumber(1)
                .status(WriteBackStatus.SUCCESS)
                .attemptedAt(Instant.parse("2026-05-31T00:00:00Z"))
                .build();
        when(writeBackAttemptRepository.findAll()).thenReturn(List.of(succeeded));

        service.retryFailedWriteBacks();

        verify(activityLogEntryRepository, never()).findById(any());
    }

    @Test
    void failuresReturnsOnlyEntriesThatHaveExhaustedMaxAttempts() {
        UUID exhaustedId = UUID.randomUUID();
        UUID stillRetryingId = UUID.randomUUID();
        UUID succeededId = UUID.randomUUID();

        WriteBackAttempt exhausted = WriteBackAttempt.builder()
                .id(UUID.randomUUID()).activityLogEntryId(exhaustedId)
                .attemptNumber(ActivityLogWriteBackService.MAX_ATTEMPTS).status(WriteBackStatus.FAILED)
                .attemptedAt(Instant.parse("2026-05-31T00:00:00Z")).build();
        WriteBackAttempt stillRetrying = WriteBackAttempt.builder()
                .id(UUID.randomUUID()).activityLogEntryId(stillRetryingId)
                .attemptNumber(1).status(WriteBackStatus.FAILED)
                .attemptedAt(Instant.parse("2026-05-31T00:01:00Z")).build();
        WriteBackAttempt succeeded = WriteBackAttempt.builder()
                .id(UUID.randomUUID()).activityLogEntryId(succeededId)
                .attemptNumber(1).status(WriteBackStatus.SUCCESS)
                .attemptedAt(Instant.parse("2026-05-31T00:02:00Z")).build();
        when(writeBackAttemptRepository.findAll()).thenReturn(List.of(exhausted, stillRetrying, succeeded));

        List<WriteBackAttempt> failures = service.failures();

        assertThat(failures).extracting(WriteBackAttempt::getActivityLogEntryId).containsExactly(exhaustedId);
    }

    @Test
    void onlyTheHighestAttemptNumberPerEntryCountsAsLatest() {
        UUID entryId = UUID.randomUUID();
        WriteBackAttempt firstAttempt = WriteBackAttempt.builder()
                .id(UUID.randomUUID()).activityLogEntryId(entryId)
                .attemptNumber(1).status(WriteBackStatus.FAILED)
                .attemptedAt(Instant.parse("2026-05-31T00:00:00Z")).build();
        WriteBackAttempt secondAttempt = WriteBackAttempt.builder()
                .id(UUID.randomUUID()).activityLogEntryId(entryId)
                .attemptNumber(2).status(WriteBackStatus.SUCCESS)
                .attemptedAt(Instant.parse("2026-05-31T00:15:00Z")).build();
        when(writeBackAttemptRepository.findAll()).thenReturn(List.of(firstAttempt, secondAttempt));

        service.retryFailedWriteBacks();

        // Latest attempt (2) succeeded, so the sweep must not touch this entry again.
        verify(activityLogEntryRepository, never()).findById(any());
        assertThat(service.failures()).isEmpty();
    }
}
