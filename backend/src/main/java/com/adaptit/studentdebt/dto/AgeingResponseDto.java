package com.adaptit.studentdebt.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/** Everything the Age Analysis workspace renders (issue #15). */
public record AgeingResponseDto(
        AgeingDto bucketTotals,
        Map<String, AgeingDto> byFundingSource,
        List<StudentAgeingRowDto> students,
        List<CreditAgeingRowDto> credits,
        BigDecimal staleCreditTotal,
        int staleCreditCount
) {
    public record StudentAgeingRowDto(
            String studentId,
            String name,
            Integer year,
            String fundingSource,
            String fundingLabel,
            AgeingDto ageing,
            BigDecimal totalOwed,
            String oldestBucketLabel
    ) {
    }

    public record CreditAgeingRowDto(
            String studentId,
            String name,
            Integer year,
            String fundingSource,
            String fundingLabel,
            String creditReason,
            java.time.LocalDate creditSince,
            int daysOwing,
            String ageingBandLabel,
            BigDecimal amountOwed,
            /** A distinct compliance finding from the 90-day audit threshold above (issue #125/#160):
             *  true once the debtor's financial year itself has ended, regardless of daysOwing. */
            boolean pastTermEnd
    ) {
    }
}
