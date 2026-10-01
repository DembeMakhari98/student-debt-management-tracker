package com.adaptit.studentdebt.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;

/**
 * One registered student's debt position for one financial year, extracted nightly from
 * Debtors / Student Fees / Student Funding / Cashiering (issue #2). Everything the risk
 * scoring engine and decision engine need is read straight off this record — nothing here
 * is hard-coded per student.
 */
@Entity
@Table(name = "debtor")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Debtor {

    /** ITS student id, e.g. STU-100234. Unique per financial year, so the PK is (id, financialYear). */
    @Id
    @Column(name = "debtor_key", length = 40)
    private String debtorKey;

    @Column(name = "student_id", length = 20, nullable = false)
    private String studentId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "financial_year", nullable = false)
    private Integer financialYear;

    @Column(nullable = false, length = 160)
    private String programme;

    @Enumerated(EnumType.STRING)
    @Column(name = "funding_source", nullable = false, length = 20)
    private FundingSource fundingSource;

    /** Free-text funding status as read from Student Funding, e.g. "NSFAS pending". Drives the risk weight. */
    @Column(name = "funding_status", nullable = false, length = 40)
    private String fundingStatus;

    @Column(name = "missed_instalments", nullable = false)
    private Integer missedInstalments = 0;

    @Column(name = "last_payment_date")
    private LocalDate lastPaymentDate;

    /** e.g. "Defaulted", or null if there is no prior arrangement. */
    @Column(name = "arrangement_status", length = 40)
    private String arrangementStatus;

    @Column(name = "ageing_current", precision = 14, scale = 2, nullable = false)
    private BigDecimal ageingCurrent = BigDecimal.ZERO;

    @Column(name = "ageing_30", precision = 14, scale = 2, nullable = false)
    private BigDecimal ageing30 = BigDecimal.ZERO;

    @Column(name = "ageing_60", precision = 14, scale = 2, nullable = false)
    private BigDecimal ageing60 = BigDecimal.ZERO;

    @Column(name = "ageing_90", precision = 14, scale = 2, nullable = false)
    private BigDecimal ageing90 = BigDecimal.ZERO;

    /** Negative here (and/or in the other buckets) means the institution owes the student. */
    @Column(name = "ageing_120", precision = 14, scale = 2, nullable = false)
    private BigDecimal ageing120 = BigDecimal.ZERO;

    @Column(name = "credit_since")
    private LocalDate creditSince;

    @Column(name = "credit_days")
    private Integer creditDays;

    @Column(name = "credit_reason", length = 200)
    private String creditReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
