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
 * One attempt to write an {@link ActivityLogEntry} back to ITS Integrator (issue #3). Insert-only —
 * a retry creates a new row rather than updating an existing one, so the attempt history (and
 * therefore the audit trail) is itself immutable, the same guarantee {@link ActivityLogEntry}
 * already gives.
 */
@Entity
@Table(name = "write_back_attempt")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WriteBackAttempt {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "activity_log_entry_id", nullable = false)
    private UUID activityLogEntryId;

    @Column(name = "attempt_number", nullable = false)
    private Integer attemptNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private WriteBackStatus status;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(name = "attempted_at", nullable = false)
    private Instant attemptedAt;
}
