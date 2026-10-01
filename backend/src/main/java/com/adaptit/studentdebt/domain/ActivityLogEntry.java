package com.adaptit.studentdebt.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * Append-only audit trail written for every agent action and every officer decision (issue #3, #6).
 * Entries are immutable once created — no update/delete path is exposed anywhere in the API.
 */
@Entity
@Table(name = "activity_log_entry")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ActivityLogEntry {

    @Id
    @GeneratedValue
    @Column(name = "id")
    private UUID id;

    @Column(name = "debtor_key", nullable = false, length = 40)
    private String debtorKey;

    @Column(nullable = false, columnDefinition = "text")
    private String text;

    /** e.g. "Risk Sentinel · overnight run", or "Officer decision · Nomsa Mahlangu". */
    @Column(nullable = false, length = 120)
    private String source;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
