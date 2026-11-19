package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.DecisionAction;
import com.adaptit.studentdebt.domain.OfficerDecision;
import com.adaptit.studentdebt.dto.CaseDetailDto;
import com.adaptit.studentdebt.dto.DecisionRequestDto;
import com.adaptit.studentdebt.dto.RecommendationDto;
import com.adaptit.studentdebt.dto.TermDto;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.OfficerDecisionRepository;
import com.adaptit.studentdebt.web.BadRequestException;
import com.adaptit.studentdebt.web.ConflictException;
import com.adaptit.studentdebt.web.NotFoundException;
import com.adaptit.studentdebt.writeback.ActivityLogWriteBackService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Handles an officer's approve / amend / decline on a case (issue #13). Every decision is written
 * as an immutable {@link OfficerDecision} plus a matching {@link ActivityLogEntry}, both with the
 * officer's identity and a timestamp, then handed to {@link ActivityLogWriteBackService} to push
 * to ITS Integrator — the auditable trail required by issue #3.
 */
@Service
public class DecisionService {

    private final DebtorRepository debtorRepository;
    private final OfficerDecisionRepository officerDecisionRepository;
    private final ActivityLogEntryRepository activityLogEntryRepository;
    private final DecisionEngineService decisionEngineService;
    private final CaseAssemblyService caseAssemblyService;
    private final CaseService caseService;
    private final ActivityLogWriteBackService writeBackService;
    private final ObjectMapper objectMapper;

    public DecisionService(DebtorRepository debtorRepository,
                            OfficerDecisionRepository officerDecisionRepository,
                            ActivityLogEntryRepository activityLogEntryRepository,
                            DecisionEngineService decisionEngineService,
                            CaseAssemblyService caseAssemblyService,
                            CaseService caseService,
                            ActivityLogWriteBackService writeBackService,
                            ObjectMapper objectMapper) {
        this.debtorRepository = debtorRepository;
        this.officerDecisionRepository = officerDecisionRepository;
        this.activityLogEntryRepository = activityLogEntryRepository;
        this.decisionEngineService = decisionEngineService;
        this.caseAssemblyService = caseAssemblyService;
        this.caseService = caseService;
        this.writeBackService = writeBackService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public CaseDetailDto decide(String debtorKey, DecisionRequestDto request) {
        Debtor debtor = debtorRepository.findById(debtorKey)
                .orElseThrow(() -> new NotFoundException("No debtor found for " + debtorKey));

        DecisionAction action;
        try {
            action = DecisionAction.valueOf(request.action().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("action must be one of APPROVE, AMEND, DECLINE");
        }
        if (action == DecisionAction.AMEND && isBlank(request.amendedTerms())) {
            throw new BadRequestException("amendedTerms is required when action = AMEND");
        }
        if (action == DecisionAction.DECLINE && isBlank(request.reason())) {
            throw new BadRequestException("reason is required when action = DECLINE");
        }

        RecommendationDto rec = decisionEngineService.recommend(debtor);

        // One final decision per recommendation (issue #215, #149): reject a second decision on the
        // same case's current recommendation outright, with who already decided it and when.
        officerDecisionRepository.findFirstByDebtorKeyAndRecommendationTypeOrderByDecidedAtDesc(debtorKey, rec.type())
                .ifPresent(existing -> {
                    throw new ConflictException("This recommendation was already decided by "
                            + existing.getDecidedBy() + " at " + existing.getDecidedAt());
                });

        Instant now = Instant.now();

        OfficerDecision decision = OfficerDecision.builder()
                .debtorKey(debtorKey)
                .recommendationType(rec.type())
                .action(action)
                .amendedTerms(request.amendedTerms())
                .reason(request.reason())
                .decidedBy(request.decidedBy())
                .decidedAt(now)
                .build();
        try {
            // Flushed immediately (not just scheduled) so a genuinely simultaneous second request —
            // one that passed the check above before this one committed — is caught here by the
            // uq_officer_decision_debtor_recommendation constraint, instead of both inserts succeeding.
            officerDecisionRepository.saveAndFlush(decision);
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("This recommendation has already been decided by another officer");
        }

        String verb = switch (action) {
            case APPROVE -> "approved";
            case AMEND -> "amended and approved";
            case DECLINE -> "declined";
        };
        String detail = switch (action) {
            case DECLINE -> " — " + request.reason();
            case AMEND -> " — original terms: " + formatTerms(rec.terms())
                    + "; amended to: " + formatAmendedTerms(request.amendedTerms());
            case APPROVE -> "";
        };
        ActivityLogEntry entry = activityLogEntryRepository.save(ActivityLogEntry.builder()
                .debtorKey(debtorKey)
                .text("Recommendation " + verb + " by " + request.decidedBy() + detail)
                .source("Officer decision · " + request.decidedBy())
                .rationale(rec.rationale())
                .evidence(String.join("; ", caseAssemblyService.evidenceOf(debtor)))
                .createdAt(now)
                .build());
        writeBackService.recordAndAttempt(entry);

        return caseService.detailFor(debtorKey);
    }

    private static String formatTerms(List<TermDto> terms) {
        return terms.stream().map(t -> t.key() + ": " + t.value()).collect(Collectors.joining(", "));
    }

    /**
     * {@code amendedTerms} is free text on the wire — the frontend sends a JSON array of
     * {@code {key, value}} (see {@code encodeAmendedTerms}), but nothing stops a direct API caller
     * sending plain text, and the field has always been stored as-is. Parse the JSON shape when
     * it's there for a readable log line; fall back to the raw string otherwise, same resilience
     * the frontend's own {@code parseAmendedTerms} uses.
     */
    private String formatAmendedTerms(String raw) {
        try {
            return formatTerms(List.of(objectMapper.readValue(raw, TermDto[].class)));
        } catch (RuntimeException ex) {
            return raw;
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
