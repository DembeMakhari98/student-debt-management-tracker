package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.DecisionAction;
import com.adaptit.studentdebt.domain.OfficerDecision;
import com.adaptit.studentdebt.dto.CaseDetailDto;
import com.adaptit.studentdebt.dto.DecisionRequestDto;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.OfficerDecisionRepository;
import com.adaptit.studentdebt.web.NotFoundException;
import jakarta.validation.ValidationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Handles an officer's approve / amend / decline on a case (issue #13). Every decision is written
 * as an immutable {@link OfficerDecision} plus a matching {@link ActivityLogEntry}, both with the
 * officer's identity and a timestamp — the auditable trail required by issue #3.
 */
@Service
public class DecisionService {

    private final DebtorRepository debtorRepository;
    private final OfficerDecisionRepository officerDecisionRepository;
    private final ActivityLogEntryRepository activityLogEntryRepository;
    private final DecisionEngineService decisionEngineService;
    private final CaseService caseService;

    public DecisionService(DebtorRepository debtorRepository,
                            OfficerDecisionRepository officerDecisionRepository,
                            ActivityLogEntryRepository activityLogEntryRepository,
                            DecisionEngineService decisionEngineService,
                            CaseService caseService) {
        this.debtorRepository = debtorRepository;
        this.officerDecisionRepository = officerDecisionRepository;
        this.activityLogEntryRepository = activityLogEntryRepository;
        this.decisionEngineService = decisionEngineService;
        this.caseService = caseService;
    }

    @Transactional
    public CaseDetailDto decide(String debtorKey, DecisionRequestDto request) {
        Debtor debtor = debtorRepository.findById(debtorKey)
                .orElseThrow(() -> new NotFoundException("No debtor found for " + debtorKey));

        DecisionAction action;
        try {
            action = DecisionAction.valueOf(request.action().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ValidationException("action must be one of APPROVE, AMEND, DECLINE");
        }
        if (action == DecisionAction.AMEND && isBlank(request.amendedTerms())) {
            throw new ValidationException("amendedTerms is required when action = AMEND");
        }
        if (action == DecisionAction.DECLINE && isBlank(request.reason())) {
            throw new ValidationException("reason is required when action = DECLINE");
        }

        String recommendationType = decisionEngineService.recommend(debtor).type();
        Instant now = Instant.now();

        OfficerDecision decision = OfficerDecision.builder()
                .debtorKey(debtorKey)
                .recommendationType(recommendationType)
                .action(action)
                .amendedTerms(request.amendedTerms())
                .reason(request.reason())
                .decidedBy(request.decidedBy())
                .decidedAt(now)
                .build();
        officerDecisionRepository.save(decision);

        String verb = switch (action) {
            case APPROVE -> "approved";
            case AMEND -> "amended and approved";
            case DECLINE -> "declined";
        };
        activityLogEntryRepository.save(ActivityLogEntry.builder()
                .debtorKey(debtorKey)
                .text("Recommendation " + verb + " by " + request.decidedBy()
                        + (action == DecisionAction.DECLINE ? " — " + request.reason() : ""))
                .source("Officer decision · " + request.decidedBy())
                .createdAt(now)
                .build());

        return caseService.detailFor(debtorKey);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
