package com.adaptit.studentdebt.dto;

import java.util.List;

/** The AI recommendation for a case — decision engine output (technical spec §5). */
public record RecommendationDto(
        String type,
        String action,
        String status,
        String rationale,
        String agent,
        String policyClause,
        List<TermDto> terms
) {
}
