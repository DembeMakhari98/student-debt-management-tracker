package com.adaptit.studentdebt.dto;

import jakarta.validation.constraints.NotBlank;

/** Body of PATCH /api/debtors/{debtorKey}/assignment (issue #56). */
public record AssignmentRequestDto(@NotBlank String officerKey) {
}
