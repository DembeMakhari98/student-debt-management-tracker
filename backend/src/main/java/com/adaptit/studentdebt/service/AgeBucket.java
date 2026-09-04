package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;

import java.math.BigDecimal;
import java.util.function.Function;

/** The five ageing buckets, in fixed Current→120+ order (technical spec §3.3 / §6.4). */
public enum AgeBucket {
    CURRENT("Current", Debtor::getAgeingCurrent),
    D30("30 days", Debtor::getAgeing30),
    D60("60 days", Debtor::getAgeing60),
    D90("90 days", Debtor::getAgeing90),
    D120("120+ days", Debtor::getAgeing120);

    private final String label;
    private final Function<Debtor, BigDecimal> accessor;

    AgeBucket(String label, Function<Debtor, BigDecimal> accessor) {
        this.label = label;
        this.accessor = accessor;
    }

    public String getLabel() {
        return label;
    }

    /** Raw signed amount in this bucket for the debtor (negative = owed back to the student). */
    public BigDecimal rawOf(Debtor d) {
        BigDecimal v = accessor.apply(d);
        return v == null ? BigDecimal.ZERO : v;
    }

    /** Positive-only amount in this bucket — how ageing tables and charts read it. */
    public BigDecimal positiveOf(Debtor d) {
        BigDecimal v = rawOf(d);
        return v.signum() > 0 ? v : BigDecimal.ZERO;
    }
}
