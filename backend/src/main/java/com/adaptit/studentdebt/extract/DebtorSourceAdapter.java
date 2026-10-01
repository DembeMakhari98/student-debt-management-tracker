package com.adaptit.studentdebt.extract;

import java.util.List;
import java.util.Map;

/**
 * The one port the nightly extraction job depends on (issue #1's architecture
 * decision — see TECHNICAL_SPECIFICATION.md §2). A real ITS Integrator-backed
 * implementation reads Debtors, Student Fees, Student Funding and Cashiering for
 * {@link #extractDebtors()}, and Student Records for {@link #extractRegisteredCounts()}.
 * Until that integration is confirmed (issue #1), {@link MockDebtorSourceAdapter}
 * stands in — swapping the two is the only change needed anywhere in the codebase.
 */
public interface DebtorSourceAdapter {

    List<ExtractedDebtor> extractDebtors();

    /** Financial year -> registered head-count, sourced from Student Records. */
    Map<Integer, Integer> extractRegisteredCounts();
}
