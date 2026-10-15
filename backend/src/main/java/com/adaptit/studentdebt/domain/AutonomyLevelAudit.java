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
 * One immutable row per change to {@code system_setting.autonomy_level} (issue #57) — who
 * changed it, the old and new value, and when. No update/delete path is exposed anywhere.
 */
@Entity
@Table(name = "autonomy_level_audit")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AutonomyLevelAudit {

    @Id
    @GeneratedValue
    @Column(name = "id")
    private UUID id;

    @Column(name = "old_level", nullable = false)
    private int oldLevel;

    @Column(name = "new_level", nullable = false)
    private int newLevel;

    @Column(name = "changed_by", nullable = false, length = 120)
    private String changedBy;

    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;
}
