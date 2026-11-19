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

    /** The policy rationale behind the recommendation an officer decided on (issue #128/#162) —
     *  null for agent-only activity (e.g. reminder cadence steps) that was never a decision. */
    @Column(columnDefinition = "text")
    private String rationale;

    /** The evidence the agent read to reach that recommendation (issue #128/#162), joined into
     *  one audit line — null for agent-only activity that was never a decision. */
    @Column(columnDefinition = "text")
    private String evidence;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
