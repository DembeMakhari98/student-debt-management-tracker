package com.adaptit.studentdebt.extract;

import com.adaptit.studentdebt.domain.JobStatus;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.JobRunLogRepository;
import com.adaptit.studentdebt.repository.RegisteredCountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Full-stack proof of issue #2's idempotency requirement: running the real nightly
 * extract against the real (H2) database twice never duplicates a row.
 */
@SpringBootTest
class NightlyExtractIdempotencyTest {

    @Autowired
    private NightlyExtractService nightlyExtractService;
    @Autowired
    private DebtorRepository debtorRepository;
    @Autowired
    private RegisteredCountRepository registeredCountRepository;
    @Autowired
    private JobRunLogRepository jobRunLogRepository;

    @Test
    void runningTheExtractTwiceDoesNotDuplicateRows() {
        long debtorsBefore = debtorRepository.count();
        long yearsBefore = registeredCountRepository.count();

        var firstRun = nightlyExtractService.runExtract();
        assertThat(firstRun.getStatus()).isEqualTo(JobStatus.SUCCESS);
        long debtorsAfterFirst = debtorRepository.count();
        long yearsAfterFirst = registeredCountRepository.count();

        // The mock adapter's 26 debtors / 5 years match the Liquibase seed 1:1 by key,
        // so an upsert leaves the row counts exactly where Liquibase left them.
        assertThat(debtorsAfterFirst).isEqualTo(debtorsBefore);
        assertThat(yearsAfterFirst).isEqualTo(yearsBefore);

        var secondRun = nightlyExtractService.runExtract();
        assertThat(secondRun.getStatus()).isEqualTo(JobStatus.SUCCESS);

        assertThat(debtorRepository.count()).isEqualTo(debtorsAfterFirst);
        assertThat(registeredCountRepository.count()).isEqualTo(yearsAfterFirst);

        // Two runs -> two audit rows, both successful.
        assertThat(jobRunLogRepository.findAllByOrderByStartedAtDesc(org.springframework.data.domain.PageRequest.of(0, 10)))
                .hasSizeGreaterThanOrEqualTo(2)
                .allSatisfy(run -> assertThat(run.getStatus()).isEqualTo(JobStatus.SUCCESS));
    }
}
