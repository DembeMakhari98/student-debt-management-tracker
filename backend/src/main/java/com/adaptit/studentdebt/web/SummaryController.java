package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.SummaryDto;
import com.adaptit.studentdebt.service.SummaryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The debt summary KPI block, shared by Home and the Tracker (issue #10). */
@RestController
public class SummaryController {

    private final SummaryService summaryService;

    public SummaryController(SummaryService summaryService) {
        this.summaryService = summaryService;
    }

    @GetMapping("/api/summary")
    public SummaryDto summary(@RequestParam(required = false) String year,
                               @RequestParam(required = false) String funding) {
        return summaryService.summarize(YearParam.parse(year), FundingParam.parse(funding));
    }
}
