package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.domain.FundingSource;

/**
 * Parses the {@code funding} query parameter, which is either a {@link FundingSource}
 * name or the literal {@code "all"} (matching the Angular frontend's `'all'` sentinel
 * for "All funding types" — see DebtService.funding in the frontend). {@code null}
 * means "all".
 */
final class FundingParam {

    private FundingParam() {
    }

    static FundingSource parse(String funding) {
        if (funding == null || funding.isBlank() || "all".equalsIgnoreCase(funding)) {
            return null;
        }
        return FundingSource.valueOf(funding.toUpperCase());
    }
}
