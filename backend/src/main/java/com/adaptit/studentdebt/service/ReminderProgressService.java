package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.ReminderCadenceProgress;
import com.adaptit.studentdebt.dto.ReminderProgressRowDto;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.ReminderCadenceProgressRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Read side of the reminder cadence (issue #60): where each single-missed-instalment case is in the
 * three-step cadence that {@link ReminderCadenceService} (issue #9) runs and records. Rows are
 * limited to the caller's {@link Portfolio} (issue #55), so an officer sees only the cases they own.
 */
@Service
public class ReminderProgressService {

    private final ReminderCadenceProgressRepository progressRepository;
    private final DebtorRepository debtorRepository;

    public ReminderProgressService(ReminderCadenceProgressRepository progressRepository,
                                   DebtorRepository debtorRepository) {
        this.progressRepository = progressRepository;
        this.debtorRepository = debtorRepository;
    }

    /**
     * Oldest cadence first. A progress row whose debtor no longer exists cannot be placed in anyone's
     * portfolio, so it is left out. A case with no assigned officer appears only under
     * {@link Portfolio#ALL}, as everywhere else (issue #55).
     */
    @Transactional(readOnly = true)
    public List<ReminderProgressRowDto> progress(Portfolio portfolio) {
        List<ReminderCadenceProgress> rows = progressRepository.findAll();
        Map<String, Debtor> debtors = debtorRepository
                .findAllById(rows.stream().map(ReminderCadenceProgress::getDebtorKey).toList())
                .stream()
                .collect(Collectors.toMap(Debtor::getDebtorKey, Function.identity()));

        return rows.stream()
                .filter(p -> debtors.containsKey(p.getDebtorKey()) && portfolio.includes(debtors.get(p.getDebtorKey())))
                .sorted(Comparator.comparing(ReminderCadenceProgress::getStartedAt)
                        .thenComparing(ReminderCadenceProgress::getDebtorKey))
                .map(p -> toRow(p, debtors.get(p.getDebtorKey())))
                .toList();
    }

    private static ReminderProgressRowDto toRow(ReminderCadenceProgress p, Debtor debtor) {
        int stepsSent = (p.getStep1SentAt() != null ? 1 : 0)
                + (p.getStep2SentAt() != null ? 1 : 0)
                + (p.getStep3SentAt() != null ? 1 : 0);
        Integer nextStep = p.getStep1SentAt() == null ? Integer.valueOf(1)
                : p.getStep2SentAt() == null ? Integer.valueOf(2)
                : p.getStep3SentAt() == null ? Integer.valueOf(3)
                : null;
        Instant nextStepDueAt = nextStep == null ? null : p.getStartedAt().plus(Duration.ofDays(dueDay(nextStep)));
        return new ReminderProgressRowDto(
                p.getDebtorKey(), debtor.getName(), debtor.getAssignedOfficer(),
                p.getStartedAt(), p.getStep1SentAt(), p.getStep2SentAt(), p.getStep3SentAt(),
                stepsSent, nextStep, nextStepDueAt);
    }

    private static int dueDay(int step) {
        return switch (step) {
            case 1 -> ReminderCadenceService.STEP_1_DUE_DAY;
            case 2 -> ReminderCadenceService.STEP_2_DUE_DAY;
            default -> ReminderCadenceService.STEP_3_DUE_DAY;
        };
    }
}
