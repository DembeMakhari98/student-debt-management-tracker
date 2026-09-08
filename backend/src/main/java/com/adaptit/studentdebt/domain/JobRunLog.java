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
 * One nightly-extraction run (issue #2). Failure is logged here rather than swallowed
 * silently — "job failure is logged and alerts the team" from the issue's acceptance
 * criteria; a real deployment would additionally page/notify off a FAILURE row.
 */
@Entity
@Table(name = "job_run_log")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobRunLog {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "job_name", nullable = false, length = 60)
    private String jobName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private JobStatus status;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at", nullable = false)
    private Instant finishedAt;

    @Column(name = "records_processed", nullable = false)
    private Integer recordsProcessed;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;
}
