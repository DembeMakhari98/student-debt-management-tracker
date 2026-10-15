package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.SummaryDto;
import com.adaptit.studentdebt.security.PortfolioResolver;
import com.adaptit.studentdebt.service.SummaryService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The debt summary KPI block, shared by Home and the Tracker (issue #10). */
@RestController
public class SummaryController {

    private final SummaryService summaryService;
    private final PortfolioResolver portfolioResolver;

    public SummaryController(SummaryService summaryService, PortfolioResolver portfolioResolver) {
        this.summaryService = summaryService;
        this.portfolioResolver = portfolioResolver;
    }

    @GetMapping("/api/summary")
    public SummaryDto summary(@RequestParam(required = false) String year,
                               @RequestParam(required = false) String funding,
                               @RequestParam(required = false) String portfolio,
                               Authentication authentication) {
        return summaryService.summarize(YearParam.parse(year), FundingParam.parse(funding),
                portfolioResolver.resolve(authentication, portfolio));
    }
}
