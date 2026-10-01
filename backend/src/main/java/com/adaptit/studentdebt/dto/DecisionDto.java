package com.adaptit.studentdebt.dto;

import com.adaptit.studentdebt.domain.OfficerDecision;

import java.time.Instant;

public record DecisionDto(
        String action,
        String amendedTerms,
        String reason,
        String decidedBy,
        Instant decidedAt
) {
    public static DecisionDto from(OfficerDecision od) {
        return new DecisionDto(od.getAction().name(), od.getAmendedTerms(), od.getReason(), od.getDecidedBy(), od.getDecidedAt());
    }
}
