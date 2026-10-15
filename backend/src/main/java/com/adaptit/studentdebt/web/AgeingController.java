package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.AgeingResponseDto;
import com.adaptit.studentdebt.security.PortfolioResolver;
import com.adaptit.studentdebt.service.AgeingService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The Age Analysis workspace (issue #15). */
@RestController
public class AgeingController {

    private final AgeingService ageingService;
    private final PortfolioResolver portfolioResolver;

    public AgeingController(AgeingService ageingService, PortfolioResolver portfolioResolver) {
        this.ageingService = ageingService;
        this.portfolioResolver = portfolioResolver;
    }

    @GetMapping("/api/ageing")
    public AgeingResponseDto ageing(@RequestParam(required = false) String year,
                                     @RequestParam(required = false) String funding,
                                     @RequestParam(required = false) String portfolio,
                                     Authentication authentication) {
        return ageingService.build(YearParam.parse(year), FundingParam.parse(funding),
                portfolioResolver.resolve(authentication, portfolio));
    }
}
