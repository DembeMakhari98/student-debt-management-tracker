package com.adaptit.studentdebt.dto;

import java.time.Instant;

public record DecisionDto(
        String action,
        String amendedTerms,
        String reason,
        String decidedBy,
        Instant decidedAt
) {
}
