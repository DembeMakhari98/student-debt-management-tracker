package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import com.adaptit.studentdebt.domain.AppUser;
import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.dto.CaseDetailDto;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.AppUserRepository;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.web.NotFoundException;
import com.adaptit.studentdebt.writeback.ActivityLogWriteBackService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * The officer roster and case reassignment (issue #56). Every reassignment is written to the
 * case's activity log and pushed to ITS Integrator like any other officer action (issue #3).
 */
@Service
public class AssignmentService {

    private final DebtorRepository debtorRepository;
    private final AppUserRepository appUserRepository;
    private final ActivityLogEntryRepository activityLogEntryRepository;
    private final ActivityLogWriteBackService writeBackService;
    private final CaseService caseService;

    public AssignmentService(DebtorRepository debtorRepository,
                              AppUserRepository appUserRepository,
                              ActivityLogEntryRepository activityLogEntryRepository,
                              ActivityLogWriteBackService writeBackService,
                              CaseService caseService) {
        this.debtorRepository = debtorRepository;
        this.appUserRepository = appUserRepository;
        this.activityLogEntryRepository = activityLogEntryRepository;
        this.writeBackService = writeBackService;
        this.caseService = caseService;
    }

    public List<AppUser> officers() {
        return appUserRepository.findAllByOfficerKeyIsNotNullAndEnabledTrueOrderByTeamAscDisplayNameAsc();
    }

    /** Reassigning a case to the officer who already holds it changes nothing and logs nothing. */
    @Transactional
    public CaseDetailDto reassign(String debtorKey, String officerKey, String reassignedBy) {
        Debtor debtor = debtorRepository.findById(debtorKey)
                .orElseThrow(() -> new NotFoundException("No debtor found for " + debtorKey));
        AppUser to = appUserRepository.findByOfficerKey(officerKey)
                .filter(AppUser::isEnabled)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown officer " + officerKey));

        String fromKey = debtor.getAssignedOfficer();
        if (Objects.equals(fromKey, to.getOfficerKey())) {
            return caseService.detailFor(debtorKey);
        }
        String from = fromKey == null ? "unassigned"
                : appUserRepository.findByOfficerKey(fromKey).map(AppUser::getDisplayName).orElse(fromKey);

        Instant now = Instant.now();
        debtor.setAssignedOfficer(to.getOfficerKey());
        debtor.setUpdatedAt(now);
        debtorRepository.save(debtor);

        ActivityLogEntry entry = activityLogEntryRepository.save(ActivityLogEntry.builder()
                .debtorKey(debtorKey)
                .text("Case reassigned from " + from + " to " + to.getDisplayName()
                        + (to.getTeam() == null ? "" : " (" + to.getTeam() + ")") + " by " + reassignedBy)
                .source("Case assignment · " + reassignedBy)
                .createdAt(now)
                .build());
        writeBackService.recordAndAttempt(entry);

        return caseService.detailFor(debtorKey);
    }
}
