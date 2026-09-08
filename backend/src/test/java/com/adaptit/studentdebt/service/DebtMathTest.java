package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Verifies the pick-up rule against TECHNICAL_SPECIFICATION.md §4.3 (issue #5). */
class DebtMathTest {

    private static Debtor debtor() {
        Debtor d = new Debtor();
        d.setMissedInstalments(0);
        d.setFundingStatus("Bursary confirmed");
        d.setAgeingCurrent(BigDecimal.ZERO);
        d.setAgeing30(BigDecimal.ZERO);
        d.setAgeing60(BigDecimal.ZERO);
        d.setAgeing90(BigDecimal.ZERO);
        d.setAgeing120(BigDecimal.ZERO);
        return d;
    }

    @Test
    void zeroBalanceIsNotPickedUp() {
        Debtor d = debtor();
        assertFalse(DebtMath.pickedUp(d, Map.of()));
    }

    @Test
    void pureCreditIsNotPickedUp() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(-5000));
        assertFalse(DebtMath.pickedUp(d, Map.of()));
    }

    @Test
    void missedInstalmentAlonePicksUp() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(1000));
        d.setMissedInstalments(1);
        assertTrue(DebtMath.pickedUp(d, Map.of()));
    }

    @Test
    void eachArrearsBucketAloneCanPickUp() {
        for (AgeBucket bucket : new AgeBucket[]{AgeBucket.D30, AgeBucket.D60, AgeBucket.D90, AgeBucket.D120}) {
            Debtor d = debtor();
            switch (bucket) {
                case D30 -> d.setAgeing30(BigDecimal.valueOf(1000));
                case D60 -> d.setAgeing60(BigDecimal.valueOf(1000));
                case D90 -> d.setAgeing90(BigDecimal.valueOf(1000));
                case D120 -> d.setAgeing120(BigDecimal.valueOf(1000));
                default -> throw new IllegalStateException();
            }
            assertTrue(DebtMath.pickedUp(d, Map.of()), "bucket: " + bucket);
        }
    }

    @Test
    void fundingRiskWeightAtCapPicksUp() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(1000));
        d.setFundingStatus("NSFAS pending");
        assertTrue(DebtMath.pickedUp(d, Map.of("NSFAS pending", 8)));
    }

    @Test
    void fundingRiskWeightBelowCapDoesNotPickUp() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(1000));
        d.setFundingStatus("Self-funded");
        assertFalse(DebtMath.pickedUp(d, Map.of("Self-funded", 7)));
    }

    @Test
    void payingOnCycleWhenNoSignalFires() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(1000));
        assertFalse(DebtMath.pickedUp(d, Map.of()));
    }

    @Test
    void mixedSignDebtorWithArrearsIsNotPickedUp() {
        // Net in credit overall (owedToStudent), but the 90-day bucket alone is still positive,
        // so rowDebt() > 0 without this guard. Regression case for issue #5.
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(-15000));
        d.setAgeing90(BigDecimal.valueOf(3000));

        assertTrue(DebtMath.owedToStudent(d));
        assertTrue(DebtMath.rowDebt(d).signum() > 0);
        assertFalse(DebtMath.pickedUp(d, Map.of()));
    }

    @Test
    void mixedSignDebtorViaFundingWeightIsNotPickedUp() {
        // Net in credit overall, but the Current bucket alone is positive and funding weight is
        // high enough to pick up on its own — confirms the guard isn't limited to the arrears path.
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(2000));
        d.setAgeing30(BigDecimal.valueOf(-20000));
        d.setFundingStatus("NSFAS declined");

        assertTrue(DebtMath.owedToStudent(d));
        assertTrue(DebtMath.rowDebt(d).signum() > 0);
        assertFalse(DebtMath.pickedUp(d, Map.of("NSFAS declined", 16)));
    }
}
