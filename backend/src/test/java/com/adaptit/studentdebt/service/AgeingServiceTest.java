package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.dto.AgeingResponseDto;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The "past term end" compliance flag on a held credit (issue #125), which must stand on its
 * own regardless of how many days the credit has been owing — the pre-existing 90-day audit
 * threshold found by the same functional test case (bug #160).
 */
class AgeingServiceTest {

    private final DebtorQueryService debtorQueryService = mock(DebtorQueryService.class);
    private final AgeingService service = new AgeingService(debtorQueryService);

    private Debtor creditDebtor(String studentId, int financialYear, int creditDays, BigDecimal creditAmount) {
        Debtor d = new Debtor();
        d.setDebtorKey(studentId + "-" + financialYear);
        d.setStudentId(studentId);
        d.setName("Test Student " + studentId);
        d.setFinancialYear(financialYear);
        d.setProgramme("Test Programme");
        d.setFundingSource(FundingSource.SELF);
        d.setFundingStatus("Self-funded");
        d.setCreditDays(creditDays);
        d.setCreditSince(LocalDate.now().minusDays(creditDays));
        d.setCreditReason("Overpayment");
        d.setAgeingCurrent(creditAmount.negate()); // negative => owed to the student
        return d;
    }

    /* =========================================================================
       isPastTermEnd() — pure boundary checks, same financial-year-end convention
       RetentionPolicyService uses (31 December of the debtor's financial year).
       ========================================================================= */

    @Test
    void notPastTermEndTheDayBeforeYearEnd() {
        Debtor d = creditDebtor("STU-1", 2026, 20, BigDecimal.TEN);
        assertThat(service.isPastTermEnd(d, LocalDate.of(2026, 12, 31))).isFalse();
    }

    @Test
    void pastTermEndTheDayAfterYearEnd() {
        Debtor d = creditDebtor("STU-1", 2026, 20, BigDecimal.TEN);
        assertThat(service.isPastTermEnd(d, LocalDate.of(2027, 1, 1))).isTrue();
    }

    @Test
    void pastTermEndIsTrueWellUnderThe90DayAuditThreshold() {
        // Only 20 days owing — nowhere near the 90-day audit finding — but 2024's term has long ended.
        Debtor d = creditDebtor("STU-1", 2024, 20, BigDecimal.TEN);
        assertThat(service.isPastTermEnd(d, LocalDate.of(2026, 11, 18))).isTrue();
    }

    @Test
    void pastTermEndIsFalseEvenWellOverThe90DayAuditThreshold() {
        // 190 days owing (stale by the 90-day rule) but the credit's own financial year isn't over yet.
        Debtor d = creditDebtor("STU-1", 2026, 190, BigDecimal.TEN);
        assertThat(service.isPastTermEnd(d, LocalDate.of(2026, 11, 18))).isFalse();
    }

    /* =========================================================================
       build() — the flag reaches the credit-ageing row, independently of daysOwing/ageingBandLabel.
       ========================================================================= */

    @Test
    void creditRowCarriesPastTermEndIndependentlyOfTheAgeingBand() {
        Debtor staleButCurrentYear = creditDebtor("STU-100341", LocalDate.now().getYear(), 190, BigDecimal.valueOf(500));
        Debtor pastTermEndButFresh = creditDebtor("STU-100355", LocalDate.now().getYear() - 2, 20, BigDecimal.valueOf(11800));
        when(debtorQueryService.rows(any(), any(), any())).thenReturn(List.of(staleButCurrentYear, pastTermEndButFresh));

        AgeingResponseDto dto = service.build(null, null, Portfolio.ALL);

        AgeingResponseDto.CreditAgeingRowDto staleRow = rowFor(dto, "STU-100341");
        AgeingResponseDto.CreditAgeingRowDto termEndRow = rowFor(dto, "STU-100355");

        assertThat(staleRow.daysOwing()).isGreaterThan(90);
        assertThat(staleRow.pastTermEnd()).isFalse();

        assertThat(termEndRow.daysOwing()).isLessThan(90);
        assertThat(termEndRow.pastTermEnd()).isTrue();

        // The pre-existing 90-day audit aggregate is unaffected by the new, independent flag.
        assertThat(dto.staleCreditCount()).isEqualTo(1);
    }

    private AgeingResponseDto.CreditAgeingRowDto rowFor(AgeingResponseDto dto, String studentId) {
        return dto.credits().stream()
                .filter(c -> c.studentId().equals(studentId))
                .findFirst()
                .orElseThrow(() -> new AssertionError("no credit row for " + studentId));
    }
}
