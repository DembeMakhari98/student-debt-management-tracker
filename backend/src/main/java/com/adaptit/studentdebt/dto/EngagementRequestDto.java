package com.adaptit.studentdebt.dto;

import jakarta.validation.constraints.NotBlank;

/** Body of POST /api/debtors/{debtorKey}/engagements (issue #59, #269). */
public record EngagementRequestDto(
        @NotBlank String channel,  // SMS | WHATSAPP | CALL | HANDOVER
        String note                // optional free text
) {
}
