package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.OfficerDecisionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Purges case history once it has outlived the POPIA-confirmed retention period —
 * 7 years after a student's final financial year (issue #20, POPIA impact assessment
 * BA answer 2026-09-08). A student's "final" financial year is approximated as the
 * latest {@link Debtor#getFinancialYear()} on file for them; a financial year is
 * treated as ending 31 December of that year. This is the only deletion path for
 * {@link com.adaptit.studentdebt.domain.ActivityLogEntry} and
 * {@link com.adaptit.studentdebt.domain.OfficerDecision} records — no update/delete
 * endpoint exposes this via the API.
 */
@Slf4j
@Service
public class RetentionPolicyService {

    private final DebtorRepository debtorRepository;
    private final ActivityLogEntryRepository activityLogEntryRepository;
    private final OfficerDecisionRepository officerDecisionRepository;
    private final Clock clock;
    private final int retentionYears;

    public RetentionPolicyService(DebtorRepository debtorRepository,
                                   ActivityLogEntryRepository activityLogEntryRepository,
                                   OfficerDecisionRepository officerDecisionRepository,
                                   Clock clock,
                                   @Value("${app.retention.case-history-years:7}") int retentionYears) {
        this.debtorRepository = debtorRepository;
        this.activityLogEntryRepository = activityLogEntryRepository;
        this.officerDecisionRepository = officerDecisionRepository;
        this.clock = clock;
        this.retentionYears = retentionYears;
    }

    /** Pure — no I/O, so eligibility boundaries can be exhaustively unit tested. */
    boolean isEligibleForPurge(int latestFinancialYear, LocalDate today) {
        LocalDate expiry = LocalDate.of(latestFinancialYear, 12, 31).plusYears(retentionYears);
        return !today.isBefore(expiry);
    }

    /** studentId -> their latest financial year on file, filtered to those past retention. */
    List<String> findStudentIdsEligibleForPurge(LocalDate today) {
        Map<String, Integer> latestYearByStudent = debtorRepository.findAll().stream()
                .collect(Collectors.toMap(Debtor::getStudentId, Debtor::getFinancialYear, Integer::max));
        return latestYearByStudent.entrySet().stream()
                .filter(e -> isEligibleForPurge(e.getValue(), today))
                .map(Map.Entry::getKey)
                .toList();
    }

    @Scheduled(cron = "0 30 1 * * *")
    @Transactional
    public void purgeExpiredCaseHistory() {
        LocalDate today = LocalDate.now(clock);
        List<String> eligibleStudentIds = findStudentIdsEligibleForPurge(today);
        for (String studentId : eligibleStudentIds) {
            List<Debtor> rows = debtorRepository.findAllByStudentId(studentId);
            for (Debtor row : rows) {
                activityLogEntryRepository.deleteAllByDebtorKey(row.getDebtorKey());
                officerDecisionRepository.deleteAllByDebtorKey(row.getDebtorKey());
            }
            debtorRepository.deleteAll(rows);
            log.info("Purged case history for studentId={} ({} financial year rows) — retention period expired",
                    studentId, rows.size());
        }
    }
}
