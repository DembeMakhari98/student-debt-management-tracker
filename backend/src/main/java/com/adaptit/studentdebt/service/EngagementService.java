package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import com.adaptit.studentdebt.domain.EngagementChannel;
import com.adaptit.studentdebt.dto.ActivityEntryDto;
import com.adaptit.studentdebt.dto.EngagementRequestDto;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.web.BadRequestException;
import com.adaptit.studentdebt.web.NotFoundException;
import com.adaptit.studentdebt.writeback.ActivityLogWriteBackService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Persists an officer's SMS/WhatsApp/call engagement action as an immutable {@link
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

    public EngagementService(DebtorRepository debtorRepository,
                              ActivityLogEntryRepository activityLogEntryRepository,
                              ActivityLogWriteBackService writeBackService,
                              CaseService caseService) {
        this.debtorRepository = debtorRepository;
        this.activityLogEntryRepository = activityLogEntryRepository;
        this.writeBackService = writeBackService;
        this.caseService = caseService;
    }

    @Transactional
    public List<ActivityEntryDto> record(String debtorKey, EngagementRequestDto request, String officerDisplayName) {
        debtorRepository.findById(debtorKey)
                .orElseThrow(() -> new NotFoundException("No debtor found for " + debtorKey));

        EngagementChannel channel;
        try {
            channel = EngagementChannel.valueOf(request.channel().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("channel must be one of SMS, WHATSAPP, CALL");
        }

        String headline = switch (channel) {
            case SMS -> "SMS sent to student";
            case WHATSAPP -> "WhatsApp message sent to student";
            case CALL -> "Call logged with student";
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

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
