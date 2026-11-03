package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.dto.ActivityEntryDto;
import com.adaptit.studentdebt.dto.CaseDetailDto;
import com.adaptit.studentdebt.dto.EngagementRequestDto;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.web.BadRequestException;
import com.adaptit.studentdebt.web.NotFoundException;
import com.adaptit.studentdebt.writeback.ActivityLogWriteBackService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Backend counterpart of the frontend-only engagement panel, #14 (issue #59). */
class EngagementServiceTest {

    private final DebtorRepository debtorRepository = mock(DebtorRepository.class);
    private final ActivityLogEntryRepository activityLogEntryRepository = mock(ActivityLogEntryRepository.class);
    private final ActivityLogWriteBackService writeBackService = mock(ActivityLogWriteBackService.class);
    private final CaseService caseService = mock(CaseService.class);

    private final EngagementService engagementService =
            new EngagementService(debtorRepository, activityLogEntryRepository, writeBackService, caseService);

    @BeforeEach
    void setUp() {
        Debtor debtor = new Debtor();
        debtor.setDebtorKey("STU-100234-2026");
        debtor.setFundingSource(FundingSource.SELF);
        debtor.setAgeingCurrent(BigDecimal.ZERO);
        debtor.setAgeing30(BigDecimal.ZERO);
        debtor.setAgeing60(BigDecimal.ZERO);
        debtor.setAgeing90(BigDecimal.ZERO);
        debtor.setAgeing120(BigDecimal.ZERO);
        when(debtorRepository.findById("STU-100234-2026")).thenReturn(Optional.of(debtor));
        when(activityLogEntryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(caseService.detailFor("STU-100234-2026")).thenReturn(
                new CaseDetailDto(null, List.of(), List.of(new ActivityEntryDto("x", "y", null)), null));
    }

    @Test
    void smsRecordsTheExpectedTextAndSource() {
        engagementService.record("STU-100234-2026", new EngagementRequestDto("SMS", null), "Nomsa Mahlangu");

        ArgumentCaptor<ActivityLogEntry> captor = ArgumentCaptor.forClass(ActivityLogEntry.class);
        verify(activityLogEntryRepository).save(captor.capture());
        assertThat(captor.getValue().getText()).isEqualTo("SMS sent to student");
        assertThat(captor.getValue().getSource()).isEqualTo("Engagement Agent · Nomsa Mahlangu");
        assertThat(captor.getValue().getDebtorKey()).isEqualTo("STU-100234-2026");
    }

    @Test
    void whatsAppRecordsTheExpectedText() {
        engagementService.record("STU-100234-2026", new EngagementRequestDto("WHATSAPP", null), "Nomsa Mahlangu");

        ArgumentCaptor<ActivityLogEntry> captor = ArgumentCaptor.forClass(ActivityLogEntry.class);
        verify(activityLogEntryRepository).save(captor.capture());
        assertThat(captor.getValue().getText()).isEqualTo("WhatsApp message sent to student");
    }

    @Test
    void callIsCaseInsensitiveAndAppendsANonBlankNote() {
        engagementService.record("STU-100234-2026", new EngagementRequestDto("call", "Promised to pay Friday"), "Nomsa Mahlangu");

        ArgumentCaptor<ActivityLogEntry> captor = ArgumentCaptor.forClass(ActivityLogEntry.class);
        verify(activityLogEntryRepository).save(captor.capture());
        assertThat(captor.getValue().getText()).isEqualTo("Call logged with student — Promised to pay Friday");
    }

    @Test
    void aBlankNoteIsNotAppended() {
        engagementService.record("STU-100234-2026", new EngagementRequestDto("CALL", "   "), "Nomsa Mahlangu");

        ArgumentCaptor<ActivityLogEntry> captor = ArgumentCaptor.forClass(ActivityLogEntry.class);
        verify(activityLogEntryRepository).save(captor.capture());
        assertThat(captor.getValue().getText()).isEqualTo("Call logged with student");
    }

    @Test
    void anUnknownChannelIsRejected() {
        assertThatThrownBy(() ->
                engagementService.record("STU-100234-2026", new EngagementRequestDto("CARRIER_PIGEON", null), "Nomsa Mahlangu"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void anUnknownDebtorIsRejectedBeforeAnyEntryIsWritten() {
        when(debtorRepository.findById("nope")).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                engagementService.record("nope", new EngagementRequestDto("SMS", null), "Nomsa Mahlangu"))
                .isInstanceOf(NotFoundException.class);

        verify(activityLogEntryRepository, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void goesThroughTheWriteBackServiceWithTheSavedEntry() {
        engagementService.record("STU-100234-2026", new EngagementRequestDto("SMS", null), "Nomsa Mahlangu");

        ArgumentCaptor<ActivityLogEntry> captor = ArgumentCaptor.forClass(ActivityLogEntry.class);
        verify(writeBackService).recordAndAttempt(captor.capture());
        assertThat(captor.getValue().getText()).isEqualTo("SMS sent to student");
    }

    @Test
    void returnsTheUpdatedActivityListFromCaseService() {
        List<ActivityEntryDto> result =
                engagementService.record("STU-100234-2026", new EngagementRequestDto("SMS", null), "Nomsa Mahlangu");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).text()).isEqualTo("x");
    }
}
