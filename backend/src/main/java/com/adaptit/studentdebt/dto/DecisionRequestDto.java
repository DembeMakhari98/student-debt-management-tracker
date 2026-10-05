package com.adaptit.studentdebt.dto;

import jakarta.validation.constraints.NotNull;

/** Body of POST /api/debtors/{id}/decision (issue #13). */
public record DecisionRequestDto(
        @NotNull String action,        // APPROVE | AMEND | DECLINE
        String amendedTerms,           // required when action = AMEND
        String reason,                 // required when action = DECLINE
        String decidedBy               // set server-side from the signed-in user's token
) {
}
