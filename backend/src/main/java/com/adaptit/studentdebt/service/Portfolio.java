package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.PortfolioScope;

import java.util.Set;

/**
 * A resolved portfolio scope (issue #55): the set of officer keys whose cases are visible, or every
 * case for {@link PortfolioScope#ALL}. Built by
 * {@link com.adaptit.studentdebt.security.PortfolioResolver} from the caller's token, never from
 * request parameters.
 */
public record Portfolio(PortfolioScope scope, Set<String> officerKeys) {

    /** Every case, assigned or not. For internal jobs and for MANAGER/ADMIN full-portfolio views. */
    public static final Portfolio ALL = new Portfolio(PortfolioScope.ALL, Set.of());

    public Portfolio {
        officerKeys = Set.copyOf(officerKeys);
    }

    public boolean includes(Debtor d) {
        return scope == PortfolioScope.ALL
                || (d.getAssignedOfficer() != null && officerKeys.contains(d.getAssignedOfficer()));
    }
}
