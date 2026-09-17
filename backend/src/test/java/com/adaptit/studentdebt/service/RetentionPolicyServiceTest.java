package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.OfficerDecisionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Case-history retention: 7 years after a student's final financial year (issue #20). */
class RetentionPolicyServiceTest {

    private final DebtorRepository debtorRepository = mock(DebtorRepository.class);
    private final ActivityLogEntryRepository activityLogEntryRepository = mock(ActivityLogEntryRepository.class);
    private final OfficerDecisionRepository officerDecisionRepository = mock(OfficerDecisionRepository.class);

    /** "Today" fixed to 2033-06-15 for every test — 2026 + 7 years = 2033-12-31, still in the future. */
    private final Clock clock = Clock.fixed(Instant.parse("2033-06-15T00:00:00Z"), ZoneOffset.UTC);

    private final RetentionPolicyService service = new RetentionPolicyService(
            debtorRepository, activityLogEntryRepository, officerDecisionRepository, clock, 7);

    private Debtor debtor(String studentId, String debtorKey, int financialYear) {
        Debtor d = new Debtor();
        d.setStudentId(studentId);
        d.setDebtorKey(debtorKey);
        d.setFinancialYear(financialYear);
        return d;
    }

    @Test
    void notEligibleWellBeforeTheRetentionWindowExpires() {
        assertThat(service.isEligibleForPurge(2030, LocalDate.of(2033, 6, 15))).isFalse();
    }

    @Test
    void notEligibleTheDayBeforeExpiry() {
        // 2026 financial year ends 2026-12-31; +7 years = 2033-12-31.
        assertThat(service.isEligibleForPurge(2026, LocalDate.of(2033, 12, 30))).isFalse();
    }

    @Test
    void eligibleOnTheExactExpiryDate() {
        assertThat(service.isEligibleForPurge(2026, LocalDate.of(2033, 12, 31))).isTrue();
    }

    @Test
    void eligibleWellAfterExpiry() {
        assertThat(service.isEligibleForPurge(2020, LocalDate.of(2033, 6, 15))).isTrue();
    }

    @Test
    void findsStudentsWhoseLatestFinancialYearHasExpired() {
        when(debtorRepository.findAll()).thenReturn(List.of(
                debtor("STU-100001", "STU-100001-2018", 2018),   // expired — only/latest year
                debtor("STU-100002", "STU-100002-2018", 2018),   // an old expired year...
                debtor("STU-100002", "STU-100002-2026", 2026),   // ...but a newer, current year too
                debtor("STU-100003", "STU-100003-2026", 2026)    // no expired year at all
        ));

        List<String> eligible = service.findStudentIdsEligibleForPurge(LocalDate.of(2033, 6, 15));

        assertThat(eligible).containsExactly("STU-100001");
    }

    @Test
    void purgeDeletesAllThreeTablesForEveryFinancialYearRowOfAnEligibleStudentOnly() {
        Debtor eligibleRow = debtor("STU-100001", "STU-100001-2018", 2018);
        Debtor ineligibleRow = debtor("STU-100003", "STU-100003-2026", 2026);

        when(debtorRepository.findAll()).thenReturn(List.of(eligibleRow, ineligibleRow));
        when(debtorRepository.findAllByStudentId("STU-100001")).thenReturn(List.of(eligibleRow));

        service.purgeExpiredCaseHistory();

        verify(activityLogEntryRepository).deleteAllByDebtorKey("STU-100001-2018");
        verify(officerDecisionRepository).deleteAllByDebtorKey("STU-100001-2018");
        verify(debtorRepository).deleteAll(List.of(eligibleRow));

        verify(debtorRepository, never()).findAllByStudentId("STU-100003");
        verify(activityLogEntryRepository, never()).deleteAllByDebtorKey("STU-100003-2026");
        verify(officerDecisionRepository, never()).deleteAllByDebtorKey("STU-100003-2026");
    }

    @Test
    void purgeIsANoOpWhenNoStudentIsEligible() {
        when(debtorRepository.findAll()).thenReturn(List.of(
                debtor("STU-100003", "STU-100003-2026", 2026)));

        service.purgeExpiredCaseHistory();

        verify(activityLogEntryRepository, never()).deleteAllByDebtorKey(anyString());
        verify(officerDecisionRepository, never()).deleteAllByDebtorKey(anyString());
        verify(debtorRepository, never()).deleteAll(org.mockito.ArgumentMatchers.<List<Debtor>>any());
    }
}
