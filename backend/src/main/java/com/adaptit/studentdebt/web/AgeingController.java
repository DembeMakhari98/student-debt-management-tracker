package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.AgeingResponseDto;
import com.adaptit.studentdebt.service.AgeingService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The Age Analysis workspace (issue #15). */
@RestController
public class AgeingController {

    private final AgeingService ageingService;

    public AgeingController(AgeingService ageingService) {
        this.ageingService = ageingService;
    }

    @GetMapping("/api/ageing")
    public AgeingResponseDto ageing(@RequestParam(required = false) String year,
                                     @RequestParam(required = false) String funding) {
        return ageingService.build(YearParam.parse(year), FundingParam.parse(funding));
    }
}
