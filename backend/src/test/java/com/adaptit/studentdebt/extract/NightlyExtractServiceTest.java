package com.adaptit.studentdebt.extract;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.domain.JobRunLog;
import com.adaptit.studentdebt.domain.JobStatus;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.JobRunLogRepository;
import com.adaptit.studentdebt.repository.RegisteredCountRepository;
import com.adaptit.studentdebt.service.RiskScoringService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
    @Mock
    private RiskScoringService riskScoringService;

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
        when(riskScoringService.loadFundingRiskWeights()).thenReturn(Map.of());

        NightlyExtractService service = new NightlyExtractService(
                sourceAdapter, debtorRepository, registeredCountRepository, jobRunLogRepository, riskScoringService);

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
                sourceAdapter, debtorRepository, registeredCountRepository, jobRunLogRepository, riskScoringService);

        JobRunLog result = service.runExtract(); // must not throw

        assertThat(result.getStatus()).isEqualTo(JobStatus.FAILURE);
        assertThat(result.getRecordsProcessed()).isZero();
        assertThat(result.getErrorMessage()).isEqualTo("ITS Integrator unreachable");
        verify(debtorRepository, never()).save(any());
    }

    /** issue #132: pickedUpSince tracks when DebtMath.pickedUp() last flipped false -> true. */
    @Test
    void newlyPickedUpDebtorGetsPickedUpSinceSetOnFirstExtract() {
        ExtractedDebtor extracted = pickedUpExtract("STU-100341-2026", 1, BigDecimal.valueOf(1000));
        when(sourceAdapter.extractDebtors()).thenReturn(List.of(extracted));
        when(sourceAdapter.extractRegisteredCounts()).thenReturn(Map.of());
        when(debtorRepository.findById("STU-100341-2026")).thenReturn(Optional.empty());
        when(jobRunLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(riskScoringService.loadFundingRiskWeights()).thenReturn(Map.of());

        NightlyExtractService service = new NightlyExtractService(
                sourceAdapter, debtorRepository, registeredCountRepository, jobRunLogRepository, riskScoringService);
        service.runExtract();

        ArgumentCaptor<Debtor> saved = ArgumentCaptor.forClass(Debtor.class);
        verify(debtorRepository).save(saved.capture());
        assertThat(saved.getValue().getPickedUpSince()).isNotNull();
    }

    @Test
    void stillPickedUpDebtorKeepsItsExistingPickedUpSince() {
        Instant firstFlagged = Instant.now().minus(3, ChronoUnit.DAYS);
        Debtor existing = new Debtor();
        existing.setDebtorKey("STU-100341-2026");
        existing.setFundingStatus("Self-funded");
        existing.setMissedInstalments(1);
        existing.setAgeingCurrent(BigDecimal.valueOf(500));
        existing.setPickedUpSince(firstFlagged);

        ExtractedDebtor extracted = pickedUpExtract("STU-100341-2026", 2, BigDecimal.valueOf(800));
        when(sourceAdapter.extractDebtors()).thenReturn(List.of(extracted));
        when(sourceAdapter.extractRegisteredCounts()).thenReturn(Map.of());
        when(debtorRepository.findById("STU-100341-2026")).thenReturn(Optional.of(existing));
        when(jobRunLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(riskScoringService.loadFundingRiskWeights()).thenReturn(Map.of());

        NightlyExtractService service = new NightlyExtractService(
                sourceAdapter, debtorRepository, registeredCountRepository, jobRunLogRepository, riskScoringService);
        service.runExtract();

        ArgumentCaptor<Debtor> saved = ArgumentCaptor.forClass(Debtor.class);
        verify(debtorRepository).save(saved.capture());
        assertThat(saved.getValue().getPickedUpSince()).isEqualTo(firstFlagged);
    }

    @Test
    void debtorNoLongerPickedUpHasItsPickedUpSinceCleared() {
        Debtor existing = new Debtor();
        existing.setDebtorKey("STU-100341-2026");
        existing.setFundingStatus("Self-funded");
        existing.setMissedInstalments(1);
        existing.setAgeingCurrent(BigDecimal.valueOf(500));
        existing.setPickedUpSince(Instant.now().minus(1, ChronoUnit.DAYS));

        // No missed instalments, no arrears, no outstanding balance — paid in full, no longer picked up.
        ExtractedDebtor extracted = new ExtractedDebtor(
                "STU-100341-2026", "STU-100341", "Mpho Sithole", 2026, "Programme",
                FundingSource.SELF, "Self-funded", 0, null, null,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                null, null, null);
        when(sourceAdapter.extractDebtors()).thenReturn(List.of(extracted));
        when(sourceAdapter.extractRegisteredCounts()).thenReturn(Map.of());
        when(debtorRepository.findById("STU-100341-2026")).thenReturn(Optional.of(existing));
        when(jobRunLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(riskScoringService.loadFundingRiskWeights()).thenReturn(Map.of());

        NightlyExtractService service = new NightlyExtractService(
                sourceAdapter, debtorRepository, registeredCountRepository, jobRunLogRepository, riskScoringService);
        service.runExtract();

        ArgumentCaptor<Debtor> saved = ArgumentCaptor.forClass(Debtor.class);
        verify(debtorRepository).save(saved.capture());
        assertThat(saved.getValue().getPickedUpSince()).isNull();
    }

    private static ExtractedDebtor pickedUpExtract(String debtorKey, int missedInstalments, BigDecimal ageingCurrent) {
        return new ExtractedDebtor(
                debtorKey, "STU-100341", "Mpho Sithole", 2026, "Programme",
                FundingSource.SELF, "Self-funded", missedInstalments, null, null,
                ageingCurrent, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                null, null, null);
    }
}
