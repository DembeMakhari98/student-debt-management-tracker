package com.adaptit.studentdebt.domain;

/** Watch / Elevated / High, per §3.3 of the technical spec. CREDIT is a display-only pseudo-band. */
public enum RiskBand {
    WATCH,
    ELEVATED,
    HIGH,
    CREDIT
}
