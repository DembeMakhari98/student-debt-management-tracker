package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import com.adaptit.studentdebt.domain.DecisionAction;
import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.EngagementChannel;
import com.adaptit.studentdebt.domain.OfficerDecision;
import com.adaptit.studentdebt.domain.RecommendationType;
import com.adaptit.studentdebt.dto.ActivityEntryDto;
import com.adaptit.studentdebt.dto.EngagementRequestDto;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.OfficerDecisionRepository;
import com.adaptit.studentdebt.web.BadRequestException;
import com.adaptit.studentdebt.web.ConflictException;
import com.adaptit.studentdebt.web.NotFoundException;
import com.adaptit.studentdebt.writeback.ActivityLogWriteBackService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Persists an officer's SMS/WhatsApp/call/hand-over engagement action as an immutable {@link
 * ActivityLogEntry} and pushes it to ITS Integrator (issue #59) — the backend counterpart of the
 * frontend-only engagement panel (#14). Officer identity always comes from the caller
 * ({@code DebtorController} resolves it from the JWT via {@code CurrentUser}), never the request
 * body, same principle {@link DecisionService} already follows.
 */
@Service
public class EngagementService {

    private final DebtorRepository debtorRepository;
    private final ActivityLogEntryRepository activityLogEntryRepository;
    private final ActivityLogWriteBackService writeBackService;
    private final CaseService caseService;
    private final OfficerDecisionRepository officerDecisionRepository;
    private final DecisionEngineService decisionEngineService;

    public EngagementService(DebtorRepository debtorRepository,
                              ActivityLogEntryRepository activityLogEntryRepository,
                              ActivityLogWriteBackService writeBackService,
                              CaseService caseService,
                              OfficerDecisionRepository officerDecisionRepository,
                              DecisionEngineService decisionEngineService) {
        this.debtorRepository = debtorRepository;
        this.activityLogEntryRepository = activityLogEntryRepository;
        this.writeBackService = writeBackService;
        this.caseService = caseService;
        this.officerDecisionRepository = officerDecisionRepository;
        this.decisionEngineService = decisionEngineService;
    }

    @Transactional
    public List<ActivityEntryDto> record(String debtorKey, EngagementRequestDto request, String officerDisplayName) {
        Debtor debtor = debtorRepository.findById(debtorKey)
                .orElseThrow(() -> new NotFoundException("No debtor found for " + debtorKey));

        EngagementChannel channel;
        try {
            channel = EngagementChannel.valueOf(request.channel().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("channel must be one of SMS, WHATSAPP, CALL, HANDOVER");
        }

        if (channel == EngagementChannel.HANDOVER) {
            requireApprovedRegistrationHold(debtorKey);
        }

        String headline = switch (channel) {
            case SMS -> "SMS sent to student";
            case WHATSAPP -> "WhatsApp message sent to student";
            case CALL -> "Call logged with student";
            case HANDOVER -> handOverHeadline(debtor);
        };
        String text = isBlank(request.note()) ? headline : headline + " — " + request.note();

        ActivityLogEntry entry = activityLogEntryRepository.save(ActivityLogEntry.builder()
                .debtorKey(debtorKey)
                .text(text)
                .source("Engagement Agent · " + officerDisplayName)
                .createdAt(Instant.now())
                .build());
        writeBackService.recordAndAttempt(entry);

        return caseService.detailFor(debtorKey).activity();
    }

    /**
     * Hand-over is Assurance's last resort for a Registration-hold case, so it may only run once an
     * officer has approved (or amended-and-approved) that recommendation — never on an unapproved,
     * declined, or non-Registration-hold case (issue #269, technical spec §6.3 rule 7).
     */
    private void requireApprovedRegistrationHold(String debtorKey) {
        DecisionAction action = officerDecisionRepository
                .findFirstByDebtorKeyAndRecommendationTypeOrderByDecidedAtDesc(
                        debtorKey, RecommendationType.REGISTRATION_HOLD.name())
                .map(OfficerDecision::getAction)
                .orElse(null);
        if (action != DecisionAction.APPROVE && action != DecisionAction.AMEND) {
            throw new ConflictException(
                    "Case must be an approved Registration hold case before it can be handed to Adapt Connect");
        }
    }

    /**
     * Collections needs the case's balance, ageing position and the AI's rationale to act without
     * the officer re-keying it (issue #138, #218 AC3). No live Adapt Connect interface is confirmed
     * yet (technical spec open item 5) — like SMS/WhatsApp, the payload is simulated as a detailed
     * activity-log entry rather than a real outbound call.
     */
    private String handOverHeadline(Debtor debtor) {
        return "Case handed over to Adapt Connect — balance " + MoneyFormat.r(DebtMath.rowDebt(debtor))
                + ", ageing to " + oldestAgeingBucketLabel(debtor)
                + ", rationale: " + decisionEngineService.recommend(debtor).rationale();
    }

    private static String oldestAgeingBucketLabel(Debtor debtor) {
        AgeBucket[] oldestFirst = {AgeBucket.D120, AgeBucket.D90, AgeBucket.D60, AgeBucket.D30, AgeBucket.CURRENT};
        for (AgeBucket bucket : oldestFirst) {
            if (bucket.positiveOf(debtor).signum() > 0) {
                return bucket.getLabel();
            }
        }
        return AgeBucket.CURRENT.getLabel();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
