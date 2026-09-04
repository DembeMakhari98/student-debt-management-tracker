package com.adaptit.studentdebt.domain;

/**
 * The 7 recommendation types the decision engine can produce (technical spec §5, business case §3.4).
 * Each carries the owning agent and the finance policy clause it sits under.
 */
public enum RecommendationType {
    REFUND("Assurance Agent", "FIN-02.6"),
    REGISTRATION_HOLD("Assurance Agent", "FIN-09.3"),
    HARDSHIP_FUND("Funding Broker", "FIN-07.1"),
    PAYMENT_ARRANGEMENT("Intervention Planner", "FIN-04.2"),
    FUNDING_CHASE("Funding Broker", "FIN-05.4"),
    REMINDER_CADENCE("Engagement Agent", "FIN-03.1"),
    MONITOR("Risk Sentinel", "FIN-01.0");

    private final String agent;
    private final String policyClause;

    RecommendationType(String agent, String policyClause) {
        this.agent = agent;
        this.policyClause = policyClause;
    }

    public String getAgent() {
        return agent;
    }

    public String getPolicyClause() {
        return policyClause;
    }
}
