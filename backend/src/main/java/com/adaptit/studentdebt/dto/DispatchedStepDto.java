package com.adaptit.studentdebt.dto;

/** One reminder-cadence step sent during a run (issue #60): which case, which of the 3 steps, and what was done. */
public record DispatchedStepDto(String debtorKey, int step, String action) {
}
