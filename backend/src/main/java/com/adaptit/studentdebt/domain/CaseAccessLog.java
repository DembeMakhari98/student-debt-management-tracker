package com.adaptit.studentdebt.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

import java.time.Instant;
import java.util.UUID;

/**
 * One opening of a student's case detail (spec §7, POPIA; FTC-38/FTC-93/TC-06): who opened which
 * case, in which role and team, and when. Immutable once written: no setters, and no update or
 * delete path in the API. Only the retention job (issue #20) removes rows.
 */
@Entity
@Immutable
@Table(name = "case_access_log")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CaseAccessLog {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "debtor_key", nullable = false, length = 40)
    private String debtorKey;

    @Column(nullable = false, length = 60)
    private String username;

    @Column(name = "display_name", nullable = false, length = 120)
    private String displayName;

    @Column(nullable = false, length = 20)
    private String role;

    @Column(length = 40)
    private String team;

    @Column(name = "accessed_at", nullable = false)
    private Instant accessedAt;
}
