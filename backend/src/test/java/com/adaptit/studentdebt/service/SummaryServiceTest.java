package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.dto.SummaryDto;
import com.adaptit.studentdebt.dto.YearlyDebtDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

/**
 * Verifies the Home debt-by-year chart's data (issue #176) against the real Liquibase-seeded data:
 * each year's bar must match the "Total debt owed to institution" KPI for that year with funding
 * "All" — the mismatch a live functional test run (FTC-73) found when the chart still read the
 * frontend's bundled demo data instead of this endpoint.
 */
@SpringBootTest
class SummaryServiceTest {

    @Autowired
    private SummaryService summaryService;

    @Test
    void everyYearsBarTotalMatchesTheTotalDebtKpiForThatYearWithFundingAll() {
        List<YearlyDebtDto> byYear = summaryService.summarizeByYear(Portfolio.ALL);
        assertFalse(byYear.isEmpty());

        for (YearlyDebtDto row : byYear) {
            SummaryDto kpi = summaryService.summarize(row.year(), null, Portfolio.ALL);
            assertEquals(0, kpi.totalDebt().compareTo(row.total()), "year " + row.year());
        }
    }

    @Test
    void eachYearsFundingSourceSplitSumsToItsTotal() {
        List<YearlyDebtDto> byYear = summaryService.summarizeByYear(Portfolio.ALL);
        assertFalse(byYear.isEmpty());

        for (YearlyDebtDto row : byYear) {
            BigDecimal sum = row.byFundingSource().values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            assertEquals(0, sum.compareTo(row.total()), "year " + row.year());
            assertEquals(FundingSource.values().length, row.byFundingSource().size());
        }
    }
}
