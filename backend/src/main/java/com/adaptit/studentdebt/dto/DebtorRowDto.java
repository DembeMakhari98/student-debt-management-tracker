package com.adaptit.studentdebt.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * One row of the Debt Management Tracker worklist, or one row of the case list — everything
 * needed to render a `qrow` / `case-item` without a second call (issues #11, #12).
 */
public record DebtorRowDto(
        String debtorKey,
        String studentId,
        String name,
        Integer year,
        String programme,
        String fundingSource,
        String fundingLabel,
        String fundingStatus,
        Integer missedInstalments,
        LocalDate lastPaymentDate,
        String arrangementStatus,
        AgeingDto ageing,
        BigDecimal balance,
        BigDecimal debt,
        BigDecimal credit,
        boolean owedToStudent,
        boolean pickedUp,
        int riskScore,
        String riskBand,
        List<SignalDto> signals,
        RecommendationDto recommendation
) {
}
