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
 * The officer's decision on a case's AI recommendation — approve, amend or decline (issue #13).
 * A decided case does not reappear as "Needs approval" once this exists for the current recommendation.
 */
@Entity
@Table(name = "officer_decision")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OfficerDecision {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "debtor_key", nullable = false, length = 40)
    private String debtorKey;

    /** The recommendation type this decision was made against, so a later re-score doesn't hide re-opened cases. */
    @Column(name = "recommendation_type", nullable = false, length = 40)
    private String recommendationType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DecisionAction action;

    /** Amended terms as officer-entered JSON (instalment count/amount etc.), only set when action = AMEND. */
    @Column(name = "amended_terms", columnDefinition = "text")
    private String amendedTerms;

    /** Required when action = DECLINE. */
    @Column(name = "reason", columnDefinition = "text")
    private String reason;

    @Column(name = "decided_by", nullable = false, length = 120)
    private String decidedBy;

    @Column(name = "decided_at", nullable = false)
    private Instant decidedAt;
}
