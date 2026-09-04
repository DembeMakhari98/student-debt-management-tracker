package com.adaptit.studentdebt.dto;

import java.util.List;

/** Filter options + autonomy config for the global chrome (issue #16). */
public record MetaDto(
        List<Integer> years,
        int currentCalendarYear,
        int defaultYear,
        List<FundingOptionDto> fundingSources,
        int autonomyLevel,
        List<AutonomyLevelDto> autonomyLevels
) {
    public record FundingOptionDto(String value, String label) {
    }

    public record AutonomyLevelDto(int level, String name, String hint) {
    }
}
