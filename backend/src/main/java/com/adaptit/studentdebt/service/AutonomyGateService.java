package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.RecommendationStatus;
import com.adaptit.studentdebt.domain.RecommendationType;
import com.adaptit.studentdebt.dto.RecommendationDto;
import org.springframework.stereotype.Service;

import java.util.Set;

/**
 * Whether the system is allowed to resolve a recommendation itself, given the
 * configured autonomy level (issue #8, technical spec §5.10). Registration hold and
 * Refund never auto-execute, regardless of level — a deliberate override of the
 * generic level behaviour, driven by the risk register in the business case.
 */
@Service
public class AutonomyGateService {

    private static final Set<String> HARD_MANUAL_TYPES =
            Set.of(RecommendationType.REFUND.name(), RecommendationType.REGISTRATION_HOLD.name());

    public boolean autoEligible(RecommendationDto rec, int autonomyLevel) {
        if (HARD_MANUAL_TYPES.contains(rec.type())) return false;
        if (rec.status().equals(RecommendationStatus.MONITORING.getLabel())) return false;
        if (autonomyLevel >= 4) return true;
        if (autonomyLevel == 3) return rec.status().equals(RecommendationStatus.AGENT_ACTING.getLabel());
        return false;
    }
}
