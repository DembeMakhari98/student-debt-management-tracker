package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.dto.ActivityEntryDto;
import com.adaptit.studentdebt.dto.CaseDetailDto;
import com.adaptit.studentdebt.dto.DecisionDto;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.OfficerDecisionRepository;
import com.adaptit.studentdebt.domain.OfficerDecision;
import com.adaptit.studentdebt.web.NotFoundException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/** Assembles the full Case Management detail view for one debtor (issue #12). */
@Service
public class CaseService {

    private final DebtorRepository debtorRepository;
    private final DebtorQueryService debtorQueryService;
    private final RiskScoringService riskScoringService;
    private final CaseAssemblyService caseAssemblyService;
    private final ActivityLogEntryRepository activityLogEntryRepository;
    private final OfficerDecisionRepository officerDecisionRepository;

    public CaseService(DebtorRepository debtorRepository,
                        DebtorQueryService debtorQueryService,
                        RiskScoringService riskScoringService,
                        CaseAssemblyService caseAssemblyService,
                        ActivityLogEntryRepository activityLogEntryRepository,
                        OfficerDecisionRepository officerDecisionRepository) {
        this.debtorRepository = debtorRepository;
        this.debtorQueryService = debtorQueryService;
        this.riskScoringService = riskScoringService;
        this.caseAssemblyService = caseAssemblyService;
        this.activityLogEntryRepository = activityLogEntryRepository;
        this.officerDecisionRepository = officerDecisionRepository;
    }

    public CaseDetailDto detailFor(String debtorKey) {
        Debtor d = debtorRepository.findById(debtorKey)
                .orElseThrow(() -> new NotFoundException("No debtor found for " + debtorKey));

        var weights = riskScoringService.loadFundingRiskWeights();
        int score = riskScoringService.score(d, weights);
        String band = DebtMath.owedToStudent(d) ? "CREDIT" : riskScoringService.bandOf(score).name();

        List<ActivityEntryDto> activity = new ArrayList<>(caseAssemblyService.activityOf(d, score, band));
        activityLogEntryRepository.findAllByDebtorKeyOrderByCreatedAtDesc(debtorKey).forEach(e ->
                activity.add(new ActivityEntryDto(e.getText(), e.getSource(), e.getCreatedAt())));

        DecisionDto lastDecision = officerDecisionRepository.findAllByDebtorKeyOrderByDecidedAtDesc(debtorKey)
                .stream().findFirst()
                .map(this::toDecisionDto)
                .orElse(null);

        return new CaseDetailDto(
                debtorQueryService.rowFor(d),
                caseAssemblyService.evidenceOf(d),
                activity,
                lastDecision);
    }

    private DecisionDto toDecisionDto(OfficerDecision od) {
        return new DecisionDto(od.getAction().name(), od.getAmendedTerms(), od.getReason(), od.getDecidedBy(), od.getDecidedAt());
    }
}
