package com.adaptit.studentdebt.dto;

import java.time.Instant;

/**
 * One case's position in the three-step reminder cadence (issue #60, #9). {@code stepsSent} is 0–3;
 * {@code nextStep} is the next step to send (1–3), or null once all three are sent, and
 * {@code nextStepDueAt} is when that step falls due (null when there is no next step).
 */
public record ReminderProgressRowDto(String debtorKey,
                                     String studentName,
                                     String assignedOfficer,
                                     Instant startedAt,
                                     Instant step1SentAt,
                                     Instant step2SentAt,
                                     Instant step3SentAt,
                                     int stepsSent,
                                     Integer nextStep,
                                     Instant nextStepDueAt) {
}
