package com.adaptit.studentdebt.dto;

import java.time.Instant;
import java.util.List;

/**
 * Response of POST /api/admin/reminders/run (issue #60): what one dispatch pass did.
 *
 * <p>{@code withheldCount} is the number of cases in a cadence that were left for an officer because
 * the autonomy level does not allow automatic dispatch (issue #8) — at the default Level 2 that is
 * every case, so {@code dispatched} is normally empty and that is not a failure.
 * {@code cancelledCount} is the number of cadences dropped because the case was paid up or moved to a
 * different decision-engine rule.
 */
public record ReminderRunResultDto(Instant ranAt,
                                   int autonomyLevel,
                                   int dispatchedCount,
                                   int withheldCount,
                                   int cancelledCount,
                                   List<DispatchedStepDto> dispatched) {
}
