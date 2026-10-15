package com.adaptit.studentdebt.domain;

/**
 * Which cases a request covers (issue #55): the caller's own caseload, their team's, or the full
 * portfolio (Level 3, MANAGER/ADMIN only).
 */
public enum PortfolioScope {
    OWN,
    TEAM,
    ALL
}
