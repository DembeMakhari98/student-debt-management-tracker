package com.adaptit.studentdebt.domain;

/** Whether a recommendation still needs a human, is already being worked by an agent, or is passive. */
public enum RecommendationStatus {
    NEEDS_APPROVAL("Needs approval"),
    AGENT_ACTING("Agent acting"),
    MONITORING("Monitoring");

    private final String label;

    RecommendationStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
