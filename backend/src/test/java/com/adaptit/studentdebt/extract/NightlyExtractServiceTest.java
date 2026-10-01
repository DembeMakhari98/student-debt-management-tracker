package com.adaptit.studentdebt.extract;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.domain.JobRunLog;
import com.adaptit.studentdebt.domain.JobStatus;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.JobRunLogRepository;
import com.adaptit.studentdebt.repository.RegisteredCountRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for issue #2's acceptance criteria: idempotent upsert, negative ageing
 * preserved, and failure logged rather than silent.
 */
@ExtendWith(MockitoExtension.class)
class NightlyExtractServiceTest {

    @Mock
    private DebtorSourceAdapter sourceAdapter;
    @Mock
    private DebtorRepository debtorRepository;
    @Mock
    private RegisteredCountRepository registeredCountRepository;
    @Mock
    private JobRunLogRepository jobRunLogRepository;

    @Test
    void successfulRunUpsertsExistingDebtorAndLogsSuccess() {
        ExtractedDebtor extracted = new ExtractedDebtor(
                "STU-100341-2026", "STU-100341", "Mpho Sithole", 2026, "Programme",
                FundingSource.SELF, "Self-funded", 0, null, null,
                BigDecimal.valueOf(-4200), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                null, 24, "Duplicate EFT receipted twice");

        when(sourceAdapter.extractDebtors()).thenReturn(List.of(extracted));
        when(sourceAdapter.extractRegisteredCounts()).thenReturn(Map.of(2026, 4812));

        // Simulate an existing row for this debtorKey — proves this is an update, not a duplicate insert.
        Debtor existing = new Debtor();
        existing.setDebtorKey("STU-100341-2026");
        when(debtorRepository.findById("STU-100341-2026")).thenReturn(Optional.of(existing));
        when(registeredCountRepository.findById(2026)).thenReturn(Optional.empty());
        when(jobRunLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        NightlyExtractService service = new NightlyExtractService(
                sourceAdapter, debtorRepository, registeredCountRepository, jobRunLogRepository);

        JobRunLog result = service.runExtract();

        assertThat(result.getStatus()).isEqualTo(JobStatus.SUCCESS);
        assertThat(result.getRecordsProcessed()).isEqualTo(2); // 1 debtor + 1 registered-count year

        ArgumentCaptor<Debtor> savedDebtor = ArgumentCaptor.forClass(Debtor.class);
        verify(debtorRepository, times(1)).save(savedDebtor.capture());
        // Negative ageing (a credit balance) must be preserved, not clamped to zero.
        assertThat(savedDebtor.getValue().getAgeingCurrent()).isEqualByComparingTo(BigDecimal.valueOf(-4200));
        assertThat(savedDebtor.getValue().getCreditReason()).isEqualTo("Duplicate EFT receipted twice");

        // findById was used (not a blind insert) — confirms the upsert looked for an existing row first.
        verify(debtorRepository, times(1)).findById("STU-100341-2026");
    }

    @Test
    void adapterFailureIsLoggedNotThrown() {
        when(sourceAdapter.extractDebtors()).thenThrow(new RuntimeException("ITS Integrator unreachable"));
        when(jobRunLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        NightlyExtractService service = new NightlyExtractService(
                sourceAdapter, debtorRepository, registeredCountRepository, jobRunLogRepository);

        JobRunLog result = service.runExtract(); // must not throw

        assertThat(result.getStatus()).isEqualTo(JobStatus.FAILURE);
        assertThat(result.getRecordsProcessed()).isZero();
        assertThat(result.getErrorMessage()).isEqualTo("ITS Integrator unreachable");
        verify(debtorRepository, never()).save(any());
    }
}
