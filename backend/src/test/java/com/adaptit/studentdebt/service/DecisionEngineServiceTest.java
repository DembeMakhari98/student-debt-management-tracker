package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.dto.RecommendationDto;
import com.adaptit.studentdebt.dto.TermDto;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the decision engine (issue #7, technical spec §5). No Spring context needed —
 * {@link DecisionEngineService} has no injected dependencies.
 */
class DecisionEngineServiceTest {

    private final DecisionEngineService engine = new DecisionEngineService();

    private static Debtor debtor() {
        Debtor d = new Debtor();
        d.setDebtorKey("STU-TEST-2026");
        d.setStudentId("STU-TEST");
        d.setName("Test Student");
        d.setFinancialYear(2026);
        d.setProgramme("Test Programme");
        d.setFundingSource(FundingSource.SELF);
        d.setFundingStatus("Self-funded");
        d.setMissedInstalments(0);
        d.setLastPaymentDate(LocalDate.of(2026, 1, 1));
        d.setArrangementStatus(null);
        d.setAgeingCurrent(BigDecimal.ZERO);
        d.setAgeing30(BigDecimal.ZERO);
        d.setAgeing60(BigDecimal.ZERO);
        d.setAgeing90(BigDecimal.ZERO);
        d.setAgeing120(BigDecimal.ZERO);
        return d;
    }

    private static Optional<TermDto> term(RecommendationDto rec, String key) {
        return rec.terms().stream().filter(t -> t.key().equals(key)).findFirst();
    }

    @Test
    void rule1_accountInCreditRecommendsRefund() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(-4200));

        RecommendationDto rec = engine.recommend(d);

        assertEquals("REFUND", rec.type());
        assertEquals("Needs approval", rec.status());
        assertEquals(MoneyFormat.r(BigDecimal.valueOf(4200)), term(rec, "Refund").orElseThrow().value());
    }

    @Test
    void rule2_defaultedArrangementWithNoPaymentRecommendsRegistrationHold() {
        Debtor d = debtor();
        d.setArrangementStatus("Defaulted");
        d.setLastPaymentDate(null);
        d.setMissedInstalments(4);

        RecommendationDto rec = engine.recommend(d);

        assertEquals("REGISTRATION_HOLD", rec.type());
        assertEquals("Needs approval", rec.status());
        assertEquals("Adapt Connect", term(rec, "Hand-over").orElseThrow().value());
    }

    @Test
    void rule3_lapsedOrDeclinedFundingRecommendsHardshipFund_cappedAtSixThousand() {
        Debtor d = debtor();
        d.setFundingStatus("NSFAS lapsed");
        d.setAgeing120(BigDecimal.valueOf(20000)); // debt*0.4 = 8000, capped at 6000

        RecommendationDto rec = engine.recommend(d);

        assertEquals("HARDSHIP_FUND", rec.type());
        assertEquals("Needs approval", rec.status());
        assertEquals(MoneyFormat.r(BigDecimal.valueOf(6000)), term(rec, "Award sought").orElseThrow().value());
    }

    @Test
    void rule3_hardshipAwardUncappedBelowCeiling() {
        Debtor d = debtor();
        d.setFundingStatus("NSFAS declined");
        d.setAgeing120(BigDecimal.valueOf(5000)); // debt*0.4 = 2000, below the cap

        RecommendationDto rec = engine.recommend(d);

        assertEquals(MoneyFormat.r(BigDecimal.valueOf(2000)), term(rec, "Award sought").orElseThrow().value());
    }

    @Test
    void rule4_fundingPendingWithTwoOrMoreMissedRecommendsHoldingArrangement() {
        Debtor d = debtor();
        d.setFundingStatus("NSFAS pending");
        d.setMissedInstalments(2);
        d.setAgeingCurrent(BigDecimal.valueOf(12000));

        RecommendationDto rec = engine.recommend(d);

        assertEquals("PAYMENT_ARRANGEMENT", rec.type());
        assertEquals("Holding arrangement, 4 instalments", rec.action());
        assertEquals("Needs approval", rec.status());
    }

    @Test
    void rule5_fundingPendingWithFewerThanTwoMissedRecommendsFundingChase() {
        Debtor d = debtor();
        d.setFundingStatus("NSFAS pending");
        d.setMissedInstalments(1);
        d.setAgeingCurrent(BigDecimal.valueOf(12000));

        RecommendationDto rec = engine.recommend(d);

        assertEquals("FUNDING_CHASE", rec.type());
        assertEquals("Agent acting", rec.status());
    }

    @Test
    void rule6_twoOrMoreMissedNonPendingNonLapsedRecommendsPaymentArrangement() {
        Debtor d = debtor();
        d.setFundingStatus("Self-funded");
        d.setMissedInstalments(2);
        d.setAgeingCurrent(BigDecimal.valueOf(12000));

        RecommendationDto rec = engine.recommend(d);

        assertEquals("PAYMENT_ARRANGEMENT", rec.type());
        assertEquals("Payment arrangement, 4 instalments", rec.action());
        assertEquals("Needs approval", rec.status());
    }

    @Test
    void rule7_exactlyOneMissedRecommendsReminderCadence() {
        Debtor d = debtor();
        d.setFundingStatus("Self-funded");
        d.setMissedInstalments(1);

        RecommendationDto rec = engine.recommend(d);

        assertEquals("REMINDER_CADENCE", rec.type());
        assertEquals("Agent acting", rec.status());
    }

    @Test
    void rule8_currentWithNoMissedFallsBackToMonitor() {
        Debtor d = debtor();
        d.setFundingStatus("Self-funded");
        d.setMissedInstalments(0);

        RecommendationDto rec = engine.recommend(d);

        assertEquals("MONITOR", rec.type());
        assertEquals("Monitoring", rec.status());
    }

    @Test
    void ruleOrder_pendingFundingWithTwoOrMoreMissedHitsRuleFourNotRuleSix() {
        // Would also satisfy Rule 6's "missed >= 2" on its own; pending status must win first.
        Debtor d = debtor();
        d.setFundingStatus("NSFAS pending");
        d.setMissedInstalments(3);
        d.setAgeingCurrent(BigDecimal.valueOf(15000));

        RecommendationDto rec = engine.recommend(d);

        assertEquals("Holding arrangement, 4 instalments", rec.action());
    }

    @Test
    void instalmentCountBands_mapDebtToInstalmentCount() {
        assertEquals(3, DebtMath.instalments(BigDecimal.valueOf(5000)));
        assertEquals(4, DebtMath.instalments(BigDecimal.valueOf(15000)));
        assertEquals(6, DebtMath.instalments(BigDecimal.valueOf(30000)));
        assertEquals(8, DebtMath.instalments(BigDecimal.valueOf(30001)));
    }

    @Test
    void recommendationShapeIncludesAllRequiredFields() {
        RecommendationDto rec = engine.recommend(debtor());

        assertNotNull(rec.type());
        assertNotNull(rec.action());
        assertNotNull(rec.status());
        assertNotNull(rec.rationale());
        assertNotNull(rec.agent());
        assertNotNull(rec.policyClause());
        assertFalse(rec.terms().isEmpty());
    }
}
