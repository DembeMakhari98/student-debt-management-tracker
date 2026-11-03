package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.ReminderProgressRowDto;
import com.adaptit.studentdebt.dto.ReminderRunResultDto;
import com.adaptit.studentdebt.security.CurrentUser;
import com.adaptit.studentdebt.security.PortfolioResolver;
import com.adaptit.studentdebt.service.ReminderCadenceService;
import com.adaptit.studentdebt.service.ReminderProgressService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Reads and triggers the reminder cadence (issue #60, #9). The progress read is limited to the
 * caller's portfolio ({@code portfolio=own|team|all}, issue #55). The manual run is MANAGER/ADMIN
 * only — enforced by {@code SecurityConfig}'s {@code /api/admin/**} rule, not here.
 */
@RestController
public class ReminderCadenceController {

    private static final Logger log = LoggerFactory.getLogger(ReminderCadenceController.class);

    private final ReminderProgressService reminderProgressService;
    private final ReminderCadenceService reminderCadenceService;
    private final PortfolioResolver portfolioResolver;

    public ReminderCadenceController(ReminderProgressService reminderProgressService,
                                     ReminderCadenceService reminderCadenceService,
                                     PortfolioResolver portfolioResolver) {
        this.reminderProgressService = reminderProgressService;
        this.reminderCadenceService = reminderCadenceService;
        this.portfolioResolver = portfolioResolver;
    }

    @GetMapping("/api/reminders/progress")
    public List<ReminderProgressRowDto> progress(@RequestParam(required = false) String portfolio,
                                                 Authentication authentication) {
        return reminderProgressService.progress(portfolioResolver.resolve(authentication, portfolio));
    }

    @PostMapping("/api/admin/reminders/run")
    public ReminderRunResultDto run(Authentication authentication) {
        log.info("Reminder cadence run triggered manually by {}", CurrentUser.displayName(authentication));
        return reminderCadenceService.runNightlyDispatch();
    }
}
