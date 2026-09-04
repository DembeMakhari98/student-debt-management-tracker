package com.adaptit.studentdebt.domain;

/** Who was meant to be paying the balance. Mirrors the prototype's FUND_KEYS. */
public enum FundingSource {
    SELF("Self-funded"),
    GOV("Government (NSFAS)"),
    PRIVATE("Private / Bursary");

    private final String label;

    FundingSource(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
