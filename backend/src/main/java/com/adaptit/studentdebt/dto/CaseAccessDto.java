package com.adaptit.studentdebt.dto;

import com.adaptit.studentdebt.domain.CaseAccessLog;

import java.time.Instant;

/** One row of GET /api/audit/case-access: who opened which case, and when. */
public record CaseAccessDto(String debtorKey, String username, String displayName, String role, String team,
                            Instant accessedAt) {

    public static CaseAccessDto from(CaseAccessLog e) {
        return new CaseAccessDto(e.getDebtorKey(), e.getUsername(), e.getDisplayName(), e.getRole(), e.getTeam(),
                e.getAccessedAt());
    }
}
