package com.adaptit.studentdebt.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Body of POST /api/debtors/{id}/decision (issue #13). */
public record DecisionRequestDto(
        @NotNull String action,        // APPROVE | AMEND | DECLINE
        String amendedTerms,           // required when action = AMEND
        String reason,                 // required when action = DECLINE
        @NotBlank String decidedBy     // the signed-in officer
) {
}
