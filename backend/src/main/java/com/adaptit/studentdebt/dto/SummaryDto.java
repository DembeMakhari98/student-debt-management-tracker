package com.adaptit.studentdebt.dto;

import java.math.BigDecimal;

/** The 5 KPI cards shared by Home and the Tracker (issue #10). */
public record SummaryDto(
        long registeredStudents,
        BigDecimal totalDebt,
        int debtorCount,
        BigDecimal totalCredit,
        int creditCount,
        BigDecimal atRisk90Plus,
        double atRisk90PlusPct,
        BigDecimal averageBalance
) {
}
