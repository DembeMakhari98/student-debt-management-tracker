package com.adaptit.studentdebt.dto;

import com.adaptit.studentdebt.domain.PortfolioEscalation;

import java.time.Instant;

/** One row of GET /api/audit/portfolio-escalations (issue #62). */
public record PortfolioEscalationDto(String username, String displayName, String role, String endpoint,
                                     String year, String funding, String scope, Instant createdAt) {

    public static PortfolioEscalationDto from(PortfolioEscalation e) {
        return new PortfolioEscalationDto(e.getUsername(), e.getDisplayName(), e.getRole(), e.getEndpoint(),
                e.getYearFilter(), e.getFundingFilter(), e.getListScope(), e.getCreatedAt());
    }
}
