package com.adaptit.studentdebt.dto;

/** Response of PUT /api/settings/autonomy (issue #57) — the level now in effect. */
public record AutonomyLevelResponseDto(int level) {
}
