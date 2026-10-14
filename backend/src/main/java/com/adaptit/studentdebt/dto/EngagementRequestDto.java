package com.adaptit.studentdebt.dto;

import jakarta.validation.constraints.NotBlank;

/** Body of POST /api/debtors/{debtorKey}/engagements (issue #59). */
public record EngagementRequestDto(
        @NotBlank String channel,  // SMS | WHATSAPP | CALL
        String note                // optional free text
) {
}
