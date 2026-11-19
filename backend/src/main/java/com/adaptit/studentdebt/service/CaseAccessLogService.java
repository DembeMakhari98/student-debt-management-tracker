package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.CaseAccessLog;
import com.adaptit.studentdebt.dto.ActivityEntryDto;
import com.adaptit.studentdebt.repository.CaseAccessLogRepository;
import com.adaptit.studentdebt.security.CurrentUser;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;

/**
 * Records every opening of a student's case detail against the signed-in user (spec §7, POPIA;
 * FTC-38, FTC-93, TC-06). Recording happens before the detail is returned, so if it cannot be
 * recorded the case is not shown.
 */
@Service
public class CaseAccessLogService {

    private final CaseAccessLogRepository repository;
    private final Clock clock;

    public CaseAccessLogService(CaseAccessLogRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional
    public CaseAccessLog recordView(String debtorKey, Authentication authentication) {
        return repository.save(CaseAccessLog.builder()
                .debtorKey(debtorKey)
                .username(authentication.getName())
                .displayName(CurrentUser.displayName(authentication))
                .role(CurrentUser.role(authentication))
                .team(CurrentUser.team(authentication))
                .accessedAt(clock.instant())
                .build());
    }

    /** The case's access entries as activity-feed rows, newest first. */
    public List<ActivityEntryDto> activityOf(String debtorKey) {
        return repository.findAllByDebtorKeyOrderByAccessedAtDesc(debtorKey).stream()
                .map(CaseAccessLogService::toActivity)
                .toList();
    }

    static ActivityEntryDto toActivity(CaseAccessLog e) {
        String who = e.getDisplayName() + " · " + roleLabel(e.getRole())
                + (e.getTeam() == null ? "" : " · " + e.getTeam());
        return new ActivityEntryDto("Case detail viewed by " + e.getDisplayName(), "Access log · " + who,
                e.getAccessedAt());
    }

    static String roleLabel(String role) {
        return switch (role) {
            case "OFFICER" -> "Officer";
            case "MANAGER" -> "Manager";
            case "ADMIN" -> "Administrator";
            default -> role;
        };
    }
}
