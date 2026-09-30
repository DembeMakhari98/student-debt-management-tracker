package com.adaptit.studentdebt.extract;

import com.adaptit.studentdebt.domain.FundingSource;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One debtor record as pulled from the source systems (Debtors, Student Fees, Student
 * Funding, Cashiering) — the shape {@link DebtorSourceAdapter} hands to the nightly
 * extraction job (issue #2). Deliberately independent of the {@code Debtor} JPA entity:
 * this is what came off the wire tonight, not what is already persisted.
 */
public record ExtractedDebtor(
        String debtorKey,
        String studentId,
        String name,
        Integer financialYear,
        String programme,
        FundingSource fundingSource,
        String fundingStatus,
        Integer missedInstalments,
        LocalDate lastPaymentDate,
        String arrangementStatus,
        BigDecimal ageingCurrent,
        BigDecimal ageing30,
        BigDecimal ageing60,
        BigDecimal ageing90,
        BigDecimal ageing120,
        LocalDate creditSince,
        Integer creditDays,
        String creditReason
) {
}
