package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.domain.JobRunLog;
import com.adaptit.studentdebt.extract.NightlyExtractService;
import com.adaptit.studentdebt.repository.JobRunLogRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Manual trigger + history for the nightly extraction job (issue #2) — lets the job be
 * exercised and verified without waiting for its 02:00 schedule to fire.
 */
@RestController
public class AdminExtractController {

    private final NightlyExtractService nightlyExtractService;
    private final JobRunLogRepository jobRunLogRepository;

    public AdminExtractController(NightlyExtractService nightlyExtractService, JobRunLogRepository jobRunLogRepository) {
        this.nightlyExtractService = nightlyExtractService;
        this.jobRunLogRepository = jobRunLogRepository;
    }

    @PostMapping("/api/admin/extract/run")
    public JobRunLog run() {
        return nightlyExtractService.runExtract();
    }

    @GetMapping("/api/admin/extract/history")
    public List<JobRunLog> history(@RequestParam(defaultValue = "20") int limit) {
        return jobRunLogRepository.findAllByOrderByStartedAtDesc(PageRequest.of(0, limit));
    }
}
