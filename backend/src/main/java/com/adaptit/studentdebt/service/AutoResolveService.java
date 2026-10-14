package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.dto.AutoResolveResultDto;
import com.adaptit.studentdebt.dto.DecisionRequestDto;
import com.adaptit.studentdebt.dto.RecommendationDto;
import com.adaptit.studentdebt.repository.OfficerDecisionRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * The server-side "scoring run" (issue #58): auto-resolves every undecided case
 * {@link AutonomyGateService#autoEligible} allows at the currently configured autonomy level
 * (issue #57). Each resolution goes through {@link DecisionService#decide}, the same save path
 * a human APPROVE click uses, so the officer_decision row, activity log entry and ITS Integrator
 * write-back (issue #3) all happen identically — just attributed to "Autonomous Agent" instead
 * of a signed-in officer.
 */
@Service
public class AutoResolveService {

    private static final String AUTONOMOUS_AGENT = "Autonomous Agent";

    private final DebtorQueryService debtorQueryService;
    private final DecisionEngineService decisionEngineService;
    private final AutonomyGateService autonomyGateService;
    private final AutonomySettingService autonomySettingService;
    private final OfficerDecisionRepository officerDecisionRepository;
    private final DecisionService decisionService;

    public AutoResolveService(DebtorQueryService debtorQueryService,
                               DecisionEngineService decisionEngineService,
                               AutonomyGateService autonomyGateService,
                               AutonomySettingService autonomySettingService,
                               OfficerDecisionRepository officerDecisionRepository,
                               DecisionService decisionService) {
        this.debtorQueryService = debtorQueryService;
        this.decisionEngineService = decisionEngineService;
        this.autonomyGateService = autonomyGateService;
        this.autonomySettingService = autonomySettingService;
        this.officerDecisionRepository = officerDecisionRepository;
        this.decisionService = decisionService;
    }

    public AutoResolveResultDto autoResolve() {
        int level = autonomySettingService.currentLevel();
        List<String> resolved = new ArrayList<>();

        for (Debtor d : debtorQueryService.allCaseDebtors()) {
            RecommendationDto rec = decisionEngineService.recommend(d);

            // Keyed to the *current* recommendation type, same as the frontend: a later
            // re-score into a different recommendation reopens the case instead of hiding it.
            boolean alreadyDecided = officerDecisionRepository
                    .findFirstByDebtorKeyAndRecommendationTypeOrderByDecidedAtDesc(d.getDebtorKey(), rec.type())
                    .isPresent();
            if (alreadyDecided || !autonomyGateService.autoEligible(rec, level)) continue;

            decisionService.decide(d.getDebtorKey(), new DecisionRequestDto("APPROVE", null, null, AUTONOMOUS_AGENT));
            resolved.add(d.getDebtorKey());
        }

        return new AutoResolveResultDto(resolved.size(), resolved);
    }
}
