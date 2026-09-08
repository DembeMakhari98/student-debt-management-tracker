package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.RiskBand;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Verifies score()/bandOf() against TECHNICAL_SPECIFICATION.md §4.1/§4.2 (issue #4). */
class RiskScoringServiceTest {

    private final RiskScoringService service = new RiskScoringService(null);

    private static Debtor debtor() {
        Debtor d = new Debtor();
        d.setDebtorKey("STU-TEST-2026");
        d.setStudentId("STU-TEST");
        d.setName("Test Student");
        d.setFinancialYear(2026);
        d.setProgramme("Test Programme");
        d.setFundingStatus("Bursary confirmed");
        d.setMissedInstalments(0);
        d.setLastPaymentDate(LocalDate.of(2026, 1, 1));
        d.setAgeingCurrent(BigDecimal.ZERO);
        d.setAgeing30(BigDecimal.ZERO);
        d.setAgeing60(BigDecimal.ZERO);
        d.setAgeing90(BigDecimal.ZERO);
        d.setAgeing120(BigDecimal.ZERO);
        return d;
    }

    private static Map<String, Integer> weights() {
        return Map.of(
                "NSFAS declined", 16,
                "NSFAS lapsed", 15,
                "Bursary lapsed", 14,
                "NSFAS pending", 12,
                "Bursary partial", 8,
                "Bursary confirmed", 0,
                "Bursary overpaid", 0,
                "Self-funded", 4
        );
    }

    @Test
    void noOutstandingBalanceAlwaysScoresZero() {
        Debtor d = debtor();
        assertEquals(0, service.score(d, weights()));
    }

    @Test
    void netCreditRowStillScoresZero() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(-5000));
        assertEquals(0, service.score(d, weights()));
    }

    @Test
    void d120AloneBelowCap() {
        Debtor d = debtor();
        d.setAgeing120(BigDecimal.valueOf(4000)); // 4000/4000 = 1
        assertEquals(19, service.score(d, weights())); // 18 + 1
    }

    @Test
    void d120AloneAtCap() {
        Debtor d = debtor();
        d.setAgeing120(BigDecimal.valueOf(60000)); // 60000/4000 = 15, capped at 12
        assertEquals(30, service.score(d, weights())); // 18 + 12
    }

    @Test
    void d90Alone() {
        Debtor d = debtor();
        d.setAgeing90(BigDecimal.valueOf(1000));
        assertEquals(14, service.score(d, weights()));
    }

    @Test
    void d60Alone() {
        Debtor d = debtor();
        d.setAgeing60(BigDecimal.valueOf(1000));
        assertEquals(8, service.score(d, weights()));
    }

    @Test
    void d30Alone() {
        Debtor d = debtor();
        d.setAgeing30(BigDecimal.valueOf(1000));
        assertEquals(5, service.score(d, weights()));
    }

    @Test
    void allAgeingBucketsStacked() {
        Debtor d = debtor();
        d.setAgeing30(BigDecimal.valueOf(1000));
        d.setAgeing60(BigDecimal.valueOf(1000));
        d.setAgeing90(BigDecimal.valueOf(1000));
        d.setAgeing120(BigDecimal.valueOf(4000));
        int score = service.score(d, weights());
        assertEquals(46, score); // (18+1) + 14 + 8 + 5
        assertEquals(RiskBand.ELEVATED, service.bandOf(score));
    }

    @Test
    void missedInstalmentsBelowCap() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(1000));
        d.setMissedInstalments(2);
        assertEquals(14, service.score(d, weights()));
    }

    @Test
    void missedInstalmentsJustUnderCap() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(1000));
        d.setMissedInstalments(3);
        assertEquals(21, service.score(d, weights()));
    }

    @Test
    void missedInstalmentsOverCapIsClampedAt22() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(1000));
        d.setMissedInstalments(4);
        assertEquals(22, service.score(d, weights()));
    }

    @Test
    void everyFundingStatusWeightIsApplied() {
        Map<String, Integer> weights = weights();
        for (Map.Entry<String, Integer> e : weights.entrySet()) {
            Debtor d = debtor();
            d.setAgeingCurrent(BigDecimal.valueOf(1000));
            d.setFundingStatus(e.getKey());
            int expected = Math.max(1, e.getValue());
            assertEquals(expected, service.score(d, weights), "funding status: " + e.getKey());
        }
    }

    @Test
    void unrecognizedFundingStatusDefaultsToZeroWeight() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(1000));
        d.setFundingStatus("Some unknown status");
        assertEquals(1, service.score(d, weights()));
    }

    @Test
    void defaultedArrangementAddsTen() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(1000));
        d.setArrangementStatus("Defaulted");
        assertEquals(10, service.score(d, weights()));
    }

    @Test
    void defaultedArrangementMatchIsCaseInsensitive() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(1000));
        d.setArrangementStatus("defaulted");
        assertEquals(10, service.score(d, weights()));
    }

    @Test
    void nonDefaultedArrangementAddsNothing() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(1000));
        d.setArrangementStatus("Active");
        assertEquals(1, service.score(d, weights()));
    }

    @Test
    void noArrangementRecordAddsNothing() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(1000));
        d.setArrangementStatus(null);
        assertEquals(1, service.score(d, weights()));
    }

    @Test
    void noPaymentOnRecordAddsEight() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(1000));
        d.setLastPaymentDate(null);
        assertEquals(8, service.score(d, weights()));
    }

    @Test
    void paymentOnRecordAddsNothing() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(1000));
        d.setLastPaymentDate(LocalDate.of(2026, 1, 1));
        assertEquals(1, service.score(d, weights()));
    }

    @Test
    void scoreIsClampedAt99() {
        Debtor d = debtor();
        d.setAgeing30(BigDecimal.valueOf(1000));
        d.setAgeing60(BigDecimal.valueOf(1000));
        d.setAgeing90(BigDecimal.valueOf(1000));
        d.setAgeing120(BigDecimal.valueOf(100000));
        d.setMissedInstalments(5);
        d.setFundingStatus("NSFAS declined");
        d.setArrangementStatus("Defaulted");
        d.setLastPaymentDate(null);
        assertEquals(99, service.score(d, weights()));
    }

    @Test
    void scoreFloorIsOneWhenNoSignalsFireButDebtIsOwed() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(1000));
        assertEquals(1, service.score(d, weights()));
    }

    @Test
    void bandBoundaries() {
        assertEquals(RiskBand.WATCH, service.bandOf(44));
        assertEquals(RiskBand.ELEVATED, service.bandOf(45));
        assertEquals(RiskBand.ELEVATED, service.bandOf(69));
        assertEquals(RiskBand.HIGH, service.bandOf(70));
    }
}
