package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.domain.ReminderCadenceProgress;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.ReminderCadenceProgressRepository;
import com.adaptit.studentdebt.repository.SystemSettingRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The Notification Dispatcher — the reminder cadence's SMS day 1 / WhatsApp day 5 / officer call
 * day 10 steps (issue #9, technical spec §5.7 rule 7), gated by autonomy level (issue #8).
 */
class ReminderCadenceServiceTest {

    private final DebtorRepository debtorRepository = mock(DebtorRepository.class);
    private final ReminderCadenceProgressRepository progressRepository = mock(ReminderCadenceProgressRepository.class);
    private final ActivityLogEntryRepository activityLogEntryRepository = mock(ActivityLogEntryRepository.class);
    private final SystemSettingRepository systemSettingRepository = mock(SystemSettingRepository.class);
    private final DecisionEngineService decisionEngineService = new DecisionEngineService();
    private final AutonomyGateService autonomyGateService = new AutonomyGateService();

    private final ReminderCadenceService service = new ReminderCadenceService(
            debtorRepository, progressRepository, activityLogEntryRepository, systemSettingRepository,
            decisionEngineService, autonomyGateService, java.time.Clock.systemUTC());

    private static Debtor reminderCadenceDebtor(String debtorKey) {
        Debtor d = new Debtor();
        d.setDebtorKey(debtorKey);
        d.setStudentId(debtorKey);
        d.setName("Test Student");
        d.setFinancialYear(2026);
        d.setProgramme("BSc IT");
        d.setFundingSource(FundingSource.SELF);
        d.setFundingStatus("Self-funded");
        d.setMissedInstalments(1);
        d.setAgeingCurrent(java.math.BigDecimal.valueOf(1500));
        d.setAgeing30(java.math.BigDecimal.ZERO);
        d.setAgeing60(java.math.BigDecimal.ZERO);
        d.setAgeing90(java.math.BigDecimal.ZERO);
        d.setAgeing120(java.math.BigDecimal.ZERO);
        return d;
    }

    private static Debtor monitorDebtor(String debtorKey) {
        Debtor d = reminderCadenceDebtor(debtorKey);
        d.setMissedInstalments(0);
        return d;
    }

    private ReminderCadenceProgress progress(String debtorKey, Instant startedAt) {
        ReminderCadenceProgress p = new ReminderCadenceProgress();
        p.setDebtorKey(debtorKey);
        p.setStartedAt(startedAt);
        return p;
    }

    @Test
    void firstObservationStartsTheClockButDispatchesNothingYet() {
        Debtor d = reminderCadenceDebtor("STU-1-2026");
        when(debtorRepository.findAll()).thenReturn(List.of(d));
        when(progressRepository.findById("STU-1-2026")).thenReturn(Optional.empty());
        Instant now = Instant.parse("2026-01-01T00:00:00Z");

        service.dispatch(List.of(d), 4, now);

        ArgumentCaptor<ReminderCadenceProgress> captor = ArgumentCaptor.forClass(ReminderCadenceProgress.class);
        verify(progressRepository).save(captor.capture());
        assertThat(captor.getValue().getStartedAt()).isEqualTo(now);
        assertThat(captor.getValue().getStep1SentAt()).isNull();
        verify(activityLogEntryRepository, never()).save(any());
    }

    @Test
    void dayOneDispatchesStepOneOnlyAtLevel4() {
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        Instant now = start.plusSeconds(24 * 3600);
        Debtor d = reminderCadenceDebtor("STU-1-2026");
        when(progressRepository.findById("STU-1-2026")).thenReturn(Optional.of(progress("STU-1-2026", start)));

        service.dispatch(List.of(d), 4, now);

        ArgumentCaptor<ActivityLogEntry> captor = ArgumentCaptor.forClass(ActivityLogEntry.class);
        verify(activityLogEntryRepository, times(1)).save(captor.capture());
        assertThat(captor.getValue().getText()).contains("SMS reminder sent");
        assertThat(captor.getValue().getSource()).isEqualTo("Engagement Agent · Reminder cadence");
    }

    @Test
    void dayTenCatchUpDispatchesAllThreeStepsWhenNoneHaveFiredYet() {
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        Instant now = start.plusSeconds(10 * 24 * 3600);
        Debtor d = reminderCadenceDebtor("STU-1-2026");
        when(progressRepository.findById("STU-1-2026")).thenReturn(Optional.of(progress("STU-1-2026", start)));

        service.dispatch(List.of(d), 4, now);

        ArgumentCaptor<ActivityLogEntry> captor = ArgumentCaptor.forClass(ActivityLogEntry.class);
        verify(activityLogEntryRepository, times(3)).save(captor.capture());
        List<String> texts = captor.getAllValues().stream().map(ActivityLogEntry::getText).toList();
        assertThat(texts).anyMatch(t -> t.contains("SMS reminder sent"));
        assertThat(texts).anyMatch(t -> t.contains("WhatsApp reminder sent"));
        assertThat(texts).anyMatch(t -> t.contains("Officer call task created"));
    }

    @Test
    void alreadyDispatchedStepsAreNeverResent() {
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        Instant now = start.plusSeconds(10 * 24 * 3600);
        Debtor d = reminderCadenceDebtor("STU-1-2026");
        ReminderCadenceProgress existing = progress("STU-1-2026", start);
        existing.setStep1SentAt(start.plusSeconds(24 * 3600));
        existing.setStep2SentAt(start.plusSeconds(5 * 24 * 3600));
        when(progressRepository.findById("STU-1-2026")).thenReturn(Optional.of(existing));

        service.dispatch(List.of(d), 4, now);

        ArgumentCaptor<ActivityLogEntry> captor = ArgumentCaptor.forClass(ActivityLogEntry.class);
        verify(activityLogEntryRepository, times(1)).save(captor.capture());
        assertThat(captor.getValue().getText()).contains("Officer call task created");
    }

    @Test
    void level2DoesNotDispatchButStillStartsAndKeepsTheClockRunning() {
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        Instant now = start.plusSeconds(10 * 24 * 3600);
        Debtor d = reminderCadenceDebtor("STU-1-2026");
        when(progressRepository.findById("STU-1-2026")).thenReturn(Optional.of(progress("STU-1-2026", start)));

        service.dispatch(List.of(d), 2, now);

        verify(activityLogEntryRepository, never()).save(any());
        verify(progressRepository).save(any());
    }

    @Test
    void level3DispatchesBecauseReminderCadenceIsAnAgentActingRule() {
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        Instant now = start.plusSeconds(24 * 3600);
        Debtor d = reminderCadenceDebtor("STU-1-2026");
        when(progressRepository.findById("STU-1-2026")).thenReturn(Optional.of(progress("STU-1-2026", start)));

        service.dispatch(List.of(d), 3, now);

        verify(activityLogEntryRepository, times(1)).save(any());
    }

    @Test
    void caseResolvedBackToZeroMissedCancelsAnyCadenceInFlight() {
        Debtor d = monitorDebtor("STU-1-2026");
        ReminderCadenceProgress existing = progress("STU-1-2026", Instant.parse("2026-01-01T00:00:00Z"));
        when(progressRepository.findById("STU-1-2026")).thenReturn(Optional.of(existing));

        service.dispatch(List.of(d), 4, Instant.parse("2026-01-05T00:00:00Z"));

        verify(progressRepository).delete(existing);
        verify(activityLogEntryRepository, never()).save(any());
    }

    @Test
    void caseEscalatedToADifferentRuleCancelsTheCadence() {
        Debtor d = reminderCadenceDebtor("STU-1-2026");
        d.setMissedInstalments(2); // now Payment arrangement, not Reminder cadence
        ReminderCadenceProgress existing = progress("STU-1-2026", Instant.parse("2026-01-01T00:00:00Z"));
        when(progressRepository.findById("STU-1-2026")).thenReturn(Optional.of(existing));

        service.dispatch(List.of(d), 4, Instant.parse("2026-01-05T00:00:00Z"));

        verify(progressRepository).delete(existing);
        verify(activityLogEntryRepository, never()).save(any());
    }

    @Test
    void noProgressAndNoLongerEligibleIsANoOp() {
        Debtor d = monitorDebtor("STU-1-2026");
        when(progressRepository.findById("STU-1-2026")).thenReturn(Optional.empty());

        service.dispatch(List.of(d), 4, Instant.parse("2026-01-05T00:00:00Z"));

        verify(progressRepository, never()).delete(any());
        verify(progressRepository, never()).save(any());
        verify(activityLogEntryRepository, never()).save(any());
    }
}
