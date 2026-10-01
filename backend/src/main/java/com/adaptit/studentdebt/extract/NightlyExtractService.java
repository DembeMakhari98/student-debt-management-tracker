package com.adaptit.studentdebt.extract;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.JobRunLog;
import com.adaptit.studentdebt.domain.JobStatus;
import com.adaptit.studentdebt.domain.RegisteredCount;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.JobRunLogRepository;
import com.adaptit.studentdebt.repository.RegisteredCountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Extracts a fresh position for every registered debtor each night (issue #2). Reads
 * through {@link DebtorSourceAdapter} rather than calling ITS Integrator directly (issue
 * #1's architecture decision — see TECHNICAL_SPECIFICATION.md §2), upserts by natural
 * key so re-running never duplicates, and always writes a {@link JobRunLog} row — success
 * or failure — so a run is never silently lost.
 */
@Service
public class NightlyExtractService {

    private static final Logger log = LoggerFactory.getLogger(NightlyExtractService.class);
    private static final String JOB_NAME = "nightly-debtor-extract";

    private final DebtorSourceAdapter sourceAdapter;
    private final DebtorRepository debtorRepository;
    private final RegisteredCountRepository registeredCountRepository;
    private final JobRunLogRepository jobRunLogRepository;

    public NightlyExtractService(DebtorSourceAdapter sourceAdapter,
                                  DebtorRepository debtorRepository,
                                  RegisteredCountRepository registeredCountRepository,
                                  JobRunLogRepository jobRunLogRepository) {
        this.sourceAdapter = sourceAdapter;
        this.debtorRepository = debtorRepository;
        this.registeredCountRepository = registeredCountRepository;
        this.jobRunLogRepository = jobRunLogRepository;
    }

    /** Fires nightly at 02:00 server time — well before officers start their shift. */
    @Scheduled(cron = "0 0 2 * * *")
    public void runScheduled() {
        runExtract();
    }

    /**
     * Runs the extract synchronously and returns its outcome — also reachable via
     * {@code POST /api/admin/extract/run} so the job can be exercised without waiting
     * for the schedule to fire.
     */
    @Transactional
    public JobRunLog runExtract() {
        Instant startedAt = Instant.now();
        try {
            int debtorCount = upsertDebtors(sourceAdapter.extractDebtors());
            int yearCount = upsertRegisteredCounts(sourceAdapter.extractRegisteredCounts());
            int total = debtorCount + yearCount;

            JobRunLog success = JobRunLog.builder()
                    .jobName(JOB_NAME)
                    .status(JobStatus.SUCCESS)
                    .startedAt(startedAt)
                    .finishedAt(Instant.now())
                    .recordsProcessed(total)
                    .build();
            jobRunLogRepository.save(success);
            log.info("{} completed: {} debtor record(s), {} registered-count record(s)", JOB_NAME, debtorCount, yearCount);
            return success;

        } catch (Exception ex) {
            log.error("{} failed", JOB_NAME, ex);
            JobRunLog failure = JobRunLog.builder()
                    .jobName(JOB_NAME)
                    .status(JobStatus.FAILURE)
                    .startedAt(startedAt)
                    .finishedAt(Instant.now())
                    .recordsProcessed(0)
                    .errorMessage(ex.getMessage())
                    .build();
            return jobRunLogRepository.save(failure);
        }
    }

    /** Upsert by debtorKey — an existing row is updated in place, never duplicated. */
    private int upsertDebtors(java.util.List<ExtractedDebtor> extracted) {
        for (ExtractedDebtor e : extracted) {
            Debtor debtor = debtorRepository.findById(e.debtorKey()).orElseGet(Debtor::new);
            debtor.setDebtorKey(e.debtorKey());
            debtor.setStudentId(e.studentId());
            debtor.setName(e.name());
            debtor.setFinancialYear(e.financialYear());
            debtor.setProgramme(e.programme());
            debtor.setFundingSource(e.fundingSource());
            debtor.setFundingStatus(e.fundingStatus());
            debtor.setMissedInstalments(e.missedInstalments());
            debtor.setLastPaymentDate(e.lastPaymentDate());
            debtor.setArrangementStatus(e.arrangementStatus());
            // Negative ageing (credit balances) is copied through as-is — never clamped to zero.
            debtor.setAgeingCurrent(e.ageingCurrent());
            debtor.setAgeing30(e.ageing30());
            debtor.setAgeing60(e.ageing60());
            debtor.setAgeing90(e.ageing90());
            debtor.setAgeing120(e.ageing120());
            debtor.setCreditSince(e.creditSince());
            debtor.setCreditDays(e.creditDays());
            debtor.setCreditReason(e.creditReason());
            debtor.setUpdatedAt(Instant.now());
            debtorRepository.save(debtor);
        }
        return extracted.size();
    }

    private int upsertRegisteredCounts(java.util.Map<Integer, Integer> counts) {
        counts.forEach((year, headcount) -> {
            RegisteredCount rc = registeredCountRepository.findById(year)
                    .orElseGet(() -> new RegisteredCount(year, headcount));
            rc.setHeadcount(headcount);
            registeredCountRepository.save(rc);
        });
        return counts.size();
    }
}
