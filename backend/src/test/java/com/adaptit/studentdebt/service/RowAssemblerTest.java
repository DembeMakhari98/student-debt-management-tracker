package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.DecisionAction;
import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.domain.OfficerDecision;
import com.adaptit.studentdebt.dto.DebtorRowDto;
import com.adaptit.studentdebt.repository.OfficerDecisionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Verifies a decided case resolves out of "Needs approval" only while the decision still matches
 * the current recommendation type — a re-score that changes the recommendation reopens the case
 * (issue #13, AC6). Also verifies a debtor in credit is never scored/banded (issue #4,
 * TECHNICAL_SPECIFICATION.md §4.2).
 */
class RowAssemblerTest {

    private final OfficerDecisionRepository officerDecisionRepository = mock(OfficerDecisionRepository.class);
    private final RowAssembler rowAssembler = new RowAssembler(
            new RiskScoringService(null), new DecisionEngineService(), new CaseAssemblyService(), officerDecisionRepository);
    private final Map<String, Integer> weights = Map.of();

    private Debtor debtor;

    @BeforeEach
    void setUp() {
        // Two missed instalments, no funding risk -> Payment arrangement, "Needs approval" (Rule 6).
        debtor = new Debtor();
        debtor.setDebtorKey("STU-100234-2026");
        debtor.setStudentId("STU-100234");
        debtor.setName("Test Student");
        debtor.setFinancialYear(2026);
        debtor.setProgramme("BSc IT");
        debtor.setFundingSource(FundingSource.SELF);
        debtor.setFundingStatus("Self-funded");
        debtor.setMissedInstalments(2);
        debtor.setLastPaymentDate(LocalDate.of(2026, 3, 1));
        debtor.setAgeingCurrent(BigDecimal.ZERO);
        debtor.setAgeing30(BigDecimal.valueOf(5000));
        debtor.setAgeing60(BigDecimal.ZERO);
        debtor.setAgeing90(BigDecimal.ZERO);
        debtor.setAgeing120(BigDecimal.ZERO);
    }

    @Test
    void undecidedCaseHasNoLastDecisionAndKeepsItsNeedsApprovalStatus() {
        when(officerDecisionRepository.findFirstByDebtorKeyAndRecommendationTypeOrderByDecidedAtDesc(any(), any()))
                .thenReturn(Optional.empty());

        DebtorRowDto row = rowAssembler.toRow(debtor, weights);

        assertThat(row.recommendation().status()).isEqualTo("Needs approval");
        assertThat(row.lastDecision()).isNull();
    }

    @Test
    void decisionMatchingTheCurrentRecommendationTypeResolvesTheRow() {
        OfficerDecision decision = OfficerDecision.builder()
                .debtorKey(debtor.getDebtorKey())
                .recommendationType("PAYMENT_ARRANGEMENT")
                .action(DecisionAction.APPROVE)
                .decidedBy("Nomsa Mahlangu")
                .decidedAt(Instant.parse("2026-09-01T10:00:00Z"))
                .build();
        when(officerDecisionRepository.findFirstByDebtorKeyAndRecommendationTypeOrderByDecidedAtDesc(
                eq(debtor.getDebtorKey()), eq("PAYMENT_ARRANGEMENT")))
                .thenReturn(Optional.of(decision));

        DebtorRowDto row = rowAssembler.toRow(debtor, weights);

        assertThat(row.lastDecision()).isNotNull();
        assertThat(row.lastDecision().action()).isEqualTo("APPROVE");
        assertThat(row.lastDecision().decidedBy()).isEqualTo("Nomsa Mahlangu");
    }

    @Test
    void staleDecisionAgainstADifferentRecommendationTypeDoesNotResolveTheRow() {
        // The officer decided against an old recommendation (e.g. a Reminder cadence) that has
        // since re-scored into a Payment arrangement -- the case must reopen.
        when(officerDecisionRepository.findFirstByDebtorKeyAndRecommendationTypeOrderByDecidedAtDesc(
                eq(debtor.getDebtorKey()), eq("PAYMENT_ARRANGEMENT")))
                .thenReturn(Optional.empty());

        DebtorRowDto row = rowAssembler.toRow(debtor, weights);

        assertThat(row.recommendation().status()).isEqualTo("Needs approval");
        assertThat(row.lastDecision()).isNull();
    }

    @Test
    void creditDebtorIsBandedCreditNotWatchElevatedOrHigh() {
        when(officerDecisionRepository.findFirstByDebtorKeyAndRecommendationTypeOrderByDecidedAtDesc(any(), any()))
                .thenReturn(Optional.empty());

        Debtor d = new Debtor();
        d.setDebtorKey("STU-CREDIT-2026");
        d.setStudentId("STU-CREDIT");
        d.setName("Credit Student");
        d.setFinancialYear(2026);
        d.setProgramme("Test Programme");
        d.setFundingSource(FundingSource.SELF);
        d.setFundingStatus("Self-funded");
        d.setAgeingCurrent(BigDecimal.valueOf(-20000)); // institution owes the student

        DebtorRowDto row = rowAssembler.toRow(d, Map.of("Self-funded", 4));

        assertThat(row.owedToStudent()).isTrue();
        assertThat(row.riskBand()).isEqualTo("CREDIT");
        assertThat(row.riskScore()).isZero();
        assertThat(row.credit()).isEqualByComparingTo(BigDecimal.valueOf(20000));
    }
}
