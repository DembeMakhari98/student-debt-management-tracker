package com.adaptit.studentdebt.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Tracks how far the three-step reminder cadence (issue #9, technical spec §5.7 rule 7) has
 * progressed for one debtor's case — since no case-lifecycle store exists yet (the architecture's
 * "Case Store" component, technical spec §2), this is the one place "day of the case being opened"
 * is anchored. A row is created the first night a debtor is observed with exactly one missed
 * instalment and deleted the moment that stops being true (paid up, or escalated to a different
 * decision-engine rule), by {@link com.adaptit.studentdebt.service.ReminderCadenceService}.
 */
@Entity
@Table(name = "reminder_cadence_progress")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ReminderCadenceProgress {

    @Id
    @Column(name = "debtor_key", length = 40)
    private String debtorKey;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "step1_sent_at")
    private Instant step1SentAt;

    @Column(name = "step2_sent_at")
    private Instant step2SentAt;

    @Column(name = "step3_sent_at")
    private Instant step3SentAt;
}
