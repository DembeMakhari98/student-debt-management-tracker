package com.adaptit.studentdebt.dto;

import java.util.List;

/** The full case view behind a Case Management detail pane (issue #12). */
public record CaseDetailDto(
        DebtorRowDto debtor,
        List<String> evidence,
        List<ActivityEntryDto> activity,
        DecisionDto lastDecision
) {
}
