package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.RecommendationType;
import com.adaptit.studentdebt.domain.ReminderCadenceProgress;
import com.adaptit.studentdebt.dto.RecommendationDto;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.ReminderCadenceProgressRepository;
import com.adaptit.studentdebt.repository.SystemSettingRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * The Notification Dispatcher (issue #9, technical spec §2, §5.7 rule 7): runs the three-step
 * reminder cadence — SMS day 1, WhatsApp day 5, officer call day 10 — for every case the decision
 * engine currently recommends a {@link RecommendationType#REMINDER_CADENCE} for, gated by the
 * autonomy level ({@link AutonomyGateService}, issue #8). When the level doesn't permit auto
 * execution, the case is left for the officer to work manually through the engagement channels
 * panel (issue #14) — the cadence clock still runs, but no step is dispatched.
 *
 * <p>No live SMS/WhatsApp gateway is confirmed yet (technical spec open item 11, still
 * unconfirmed after issue #21's platform-team answer, which only covered browser support and tech
 * stack). Each step is recorded as an {@link ActivityLogEntry}, the same simulated-dispatch
 * approach issue #14 used for the manual engagement buttons — swap the {@code log(...)} calls
 * below for a real gateway client once a provider is confirmed; nothing else here needs to change.
 */
@Slf4j
@Service
public class ReminderCadenceService {

    static final int STEP_1_DUE_DAY = 1;
    static final int STEP_2_DUE_DAY = 5;
    static final int STEP_3_DUE_DAY = 10;

    private final DebtorRepository debtorRepository;
    private final ReminderCadenceProgressRepository progressRepository;
    private final ActivityLogEntryRepository activityLogEntryRepository;
    private final SystemSettingRepository systemSettingRepository;
    private final DecisionEngineService decisionEngineService;
    private final AutonomyGateService autonomyGateService;
    private final Clock clock;

    public ReminderCadenceService(DebtorRepository debtorRepository,
                                   ReminderCadenceProgressRepository progressRepository,
                                   ActivityLogEntryRepository activityLogEntryRepository,
                                   SystemSettingRepository systemSettingRepository,
                                   DecisionEngineService decisionEngineService,
                                   AutonomyGateService autonomyGateService,
                                   Clock clock) {
        this.debtorRepository = debtorRepository;
        this.progressRepository = progressRepository;
        this.activityLogEntryRepository = activityLogEntryRepository;
        this.systemSettingRepository = systemSettingRepository;
        this.decisionEngineService = decisionEngineService;
        this.autonomyGateService = autonomyGateService;
        this.clock = clock;
    }

    /** Runs after the nightly scoring pass would have refreshed {@code missed_instalments}. */
    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void runNightlyDispatch() {
        int autonomyLevel = systemSettingRepository.findById("autonomy_level")
                .map(s -> Integer.parseInt(s.getSettingValue()))
                .orElse(2);
        dispatch(debtorRepository.findAll(), autonomyLevel, Instant.now(clock));
    }

    /**
     * Core dispatch pass, isolated from the scheduler/clock/setting lookup so it can be driven
     * deterministically in tests.
     */
    void dispatch(List<Debtor> debtors, int autonomyLevel, Instant now) {
        for (Debtor debtor : debtors) {
            RecommendationDto rec = decisionEngineService.recommend(debtor);
            ReminderCadenceProgress progress = progressRepository.findById(debtor.getDebtorKey()).orElse(null);

            if (!RecommendationType.REMINDER_CADENCE.name().equals(rec.type())) {
                // Resolved (paid up) or escalated to a different rule — cancel any cadence in flight.
                if (progress != null) {
                    progressRepository.delete(progress);
                }
                continue;
            }

            if (progress == null) {
                progress = new ReminderCadenceProgress();
                progress.setDebtorKey(debtor.getDebtorKey());
                progress.setStartedAt(now);
            }

            if (!autonomyGateService.autoEligible(rec, autonomyLevel)) {
                // Needs approval at this autonomy level — queued, per issue #8's Level 2 default.
                // The clock still starts/keeps running; only dispatch is withheld.
                progressRepository.save(progress);
                continue;
            }

            long daysSinceStart = Duration.between(progress.getStartedAt(), now).toDays();

            if (progress.getStep1SentAt() == null && daysSinceStart >= STEP_1_DUE_DAY) {
                progress.setStep1SentAt(now);
                recordDispatch(debtor.getDebtorKey(), "SMS reminder sent (step 1 of 3, day 1)", now);
            }
            if (progress.getStep2SentAt() == null && daysSinceStart >= STEP_2_DUE_DAY) {
                progress.setStep2SentAt(now);
                recordDispatch(debtor.getDebtorKey(), "WhatsApp reminder sent (step 2 of 3, day 5)", now);
            }
            if (progress.getStep3SentAt() == null && daysSinceStart >= STEP_3_DUE_DAY) {
                progress.setStep3SentAt(now);
                recordDispatch(debtor.getDebtorKey(), "Officer call task created (step 3 of 3, day 10)", now);
            }
            progressRepository.save(progress);
        }
    }

    private void recordDispatch(String debtorKey, String text, Instant now) {
        activityLogEntryRepository.save(ActivityLogEntry.builder()
                .debtorKey(debtorKey)
                .text(text)
                .source("Engagement Agent · Reminder cadence")
                .createdAt(now)
                .build());
        log.info("Reminder cadence step dispatched for debtorKey={}: {}", debtorKey, text);
    }
}
