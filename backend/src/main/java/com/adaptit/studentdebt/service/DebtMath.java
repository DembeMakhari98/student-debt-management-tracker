package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Pure, stateless derivations off a single debtor record — a direct port of the prototype's
 * rowTotal / rowDebt / arrears / over90 / pickedUp / owedToStudent functions. Nothing here is
 * hard-coded per student; it is all read off the ageing buckets, missed count and funding status.
 */
public final class DebtMath {

    private DebtMath() {
    }

    /** Signed sum across all five buckets — negative means the institution owes the student. */
    public static BigDecimal rowTotal(Debtor d) {
        BigDecimal sum = BigDecimal.ZERO;
        for (AgeBucket b : AgeBucket.values()) {
            sum = sum.add(b.rawOf(d));
        }
        return sum;
    }

    /** Positive-only outstanding balance — what the student owes the institution. */
    public static BigDecimal rowDebt(Debtor d) {
        BigDecimal sum = BigDecimal.ZERO;
        for (AgeBucket b : AgeBucket.values()) {
            sum = sum.add(b.positiveOf(d));
        }
        return sum;
    }

    /** Everything behind Current — the arrears position. */
    public static BigDecimal arrears(Debtor d) {
        return AgeBucket.D30.positiveOf(d)
                .add(AgeBucket.D60.positiveOf(d))
                .add(AgeBucket.D90.positiveOf(d))
                .add(AgeBucket.D120.positiveOf(d));
    }

    /** The 90+ day exposure that feeds the "at risk" KPI and the risk score most heavily. */
    public static BigDecimal over90(Debtor d) {
        return AgeBucket.D90.positiveOf(d).add(AgeBucket.D120.positiveOf(d));
    }

    public static boolean owedToStudent(Debtor d) {
        return rowTotal(d).signum() < 0;
    }

    /**
     * "Picked up" rule (business case §3.3): owes money AND (missed an instalment, OR is in
     * arrears, OR funding-status risk weight is 8 or more).
     */
    public static boolean pickedUp(Debtor d, Map<String, Integer> fundingRiskWeights) {
        if (owedToStudent(d) || rowDebt(d).signum() <= 0) {
            return false;
        }
        int missed = d.getMissedInstalments() == null ? 0 : d.getMissedInstalments();
        int weight = fundingRiskWeights.getOrDefault(d.getFundingStatus(), 0);
        return missed > 0 || arrears(d).signum() > 0 || weight >= 8;
    }

    /** The oldest bucket the student's own (positive) balance has reached. */
    public static AgeBucket oldestBucket(Debtor d) {
        AgeBucket[] values = AgeBucket.values();
        for (int i = values.length - 1; i >= 0; i--) {
            if (values[i].positiveOf(d).signum() > 0) {
                return values[i];
            }
        }
        return AgeBucket.CURRENT;
    }

    public static int instalments(BigDecimal debt) {
        double v = debt.doubleValue();
        if (v <= 5000) return 3;
        if (v <= 15000) return 4;
        if (v <= 30000) return 6;
        return 8;
    }
}
