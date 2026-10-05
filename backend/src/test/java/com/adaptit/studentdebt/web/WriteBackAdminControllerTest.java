package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import com.adaptit.studentdebt.domain.WriteBackAttempt;
import com.adaptit.studentdebt.domain.WriteBackStatus;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.writeback.ActivityLogWriteBackService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Unit test for issue #3's AC3 "surfaced" half: GET /api/admin/writeback/failures. */
class WriteBackAdminControllerTest {

    private final ActivityLogWriteBackService writeBackService = mock(ActivityLogWriteBackService.class);
    private final ActivityLogEntryRepository activityLogEntryRepository = mock(ActivityLogEntryRepository.class);

    private final WriteBackAdminController controller =
            new WriteBackAdminController(writeBackService, activityLogEntryRepository);

    @Test
    void returnsOneFailureDtoPerExhaustedAttemptEnrichedFromTheSourceEntry() {
        UUID entryId = UUID.randomUUID();
        Instant attemptedAt = Instant.parse("2026-06-01T00:00:00Z");
        WriteBackAttempt exhausted = WriteBackAttempt.builder()
                .id(UUID.randomUUID())
                .activityLogEntryId(entryId)
                .attemptNumber(3)
                .status(WriteBackStatus.FAILED)
                .errorMessage("ITS Integrator unreachable")
                .attemptedAt(attemptedAt)
                .build();
        when(writeBackService.failures()).thenReturn(List.of(exhausted));

        ActivityLogEntry entry = ActivityLogEntry.builder()
                .id(entryId)
                .debtorKey("STU-100234-2026")
                .text("Recommendation approved by Nomsa Mahlangu")
                .source("Officer decision · Nomsa Mahlangu")
                .createdAt(Instant.parse("2026-05-31T23:00:00Z"))
                .build();
        when(activityLogEntryRepository.findById(entryId)).thenReturn(Optional.of(entry));

        var result = controller.failures();

        assertThat(result).hasSize(1);
        var dto = result.get(0);
        assertThat(dto.activityLogEntryId()).isEqualTo(entryId);
        assertThat(dto.debtorKey()).isEqualTo("STU-100234-2026");
        assertThat(dto.text()).isEqualTo("Recommendation approved by Nomsa Mahlangu");
        assertThat(dto.attemptCount()).isEqualTo(3);
        assertThat(dto.lastAttemptedAt()).isEqualTo(attemptedAt);
        assertThat(dto.lastError()).isEqualTo("ITS Integrator unreachable");
    }

    @Test
    void returnsAnEmptyListWhenNothingHasExhaustedRetries() {
        when(writeBackService.failures()).thenReturn(List.of());

        assertThat(controller.failures()).isEmpty();
    }

    @Test
    void stillReturnsADtoWithNullFieldsIfTheSourceEntryWasSomehowDeleted() {
        UUID entryId = UUID.randomUUID();
        WriteBackAttempt exhausted = WriteBackAttempt.builder()
                .id(UUID.randomUUID()).activityLogEntryId(entryId).attemptNumber(3)
                .status(WriteBackStatus.FAILED).attemptedAt(Instant.now()).build();
        when(writeBackService.failures()).thenReturn(List.of(exhausted));
        when(activityLogEntryRepository.findById(entryId)).thenReturn(Optional.empty());

        var result = controller.failures();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).debtorKey()).isNull();
        assertThat(result.get(0).activityLogEntryId()).isEqualTo(entryId);
    }
}
