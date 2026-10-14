package com.adaptit.studentdebt.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** Body of PUT /api/settings/autonomy (issue #57). */
public record AutonomyUpdateRequestDto(
        @NotNull @Min(1) @Max(4) Integer level
) {
}
