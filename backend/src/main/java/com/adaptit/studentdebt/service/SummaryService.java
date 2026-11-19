package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.dto.SummaryDto;
import com.adaptit.studentdebt.dto.YearlyDebtDto;
import com.adaptit.studentdebt.repository.RegisteredCountRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The 5 KPI cards shared by Home and the Tracker (issue #10). Debt figures cover the caller's
 * portfolio (issue #55); the registered-students headcount is institution-wide.
 */
@Service
public class SummaryService {

    private final DebtorQueryService debtorQueryService;
    private final RegisteredCountRepository registeredCountRepository;

    public SummaryService(DebtorQueryService debtorQueryService, RegisteredCountRepository registeredCountRepository) {
        this.debtorQueryService = debtorQueryService;
        this.registeredCountRepository = registeredCountRepository;
    }

    public SummaryDto summarize(Integer year, FundingSource funding, Portfolio portfolio) {
        List<Debtor> rows = debtorQueryService.rows(year, funding, portfolio);

        List<Debtor> debtors = rows.stream().filter(d -> DebtMath.rowTotal(d).signum() > 0).toList();
        List<Debtor> credits = rows.stream().filter(DebtMath::owedToStudent).toList();

        BigDecimal totalDebt = debtors.stream().map(DebtMath::rowTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCredit = credits.stream().map(DebtMath::rowTotal).reduce(BigDecimal.ZERO, BigDecimal::add).abs();
        BigDecimal o90 = rows.stream().map(DebtMath::over90).reduce(BigDecimal.ZERO, BigDecimal::add);

        long registered = year == null
                ? registeredCountRepository.findAll().stream().mapToLong(rc -> rc.getHeadcount()).sum()
                : registeredCountRepository.findById(year).map(rc -> (long) rc.getHeadcount()).orElse(0L);

        double o90Pct = totalDebt.signum() == 0 ? 0.0
                : o90.divide(totalDebt, 6, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue();

        BigDecimal avg = debtors.isEmpty() ? BigDecimal.ZERO
                : totalDebt.divide(BigDecimal.valueOf(debtors.size()), 2, RoundingMode.HALF_UP);

        return new SummaryDto(registered, totalDebt, debtors.size(), totalCredit, credits.size(), o90, o90Pct, avg);
    }

    /**
     * One row per financial year on record, for the Home debt-by-year chart (issue #176): total
     * debt owed to the institution, split by funding source, scoped to the caller's portfolio so
     * each bar's total matches the KPI {@link #summarize} returns for that year with funding "All".
     */
    public List<YearlyDebtDto> summarizeByYear(Portfolio portfolio) {
        List<Debtor> all = debtorQueryService.rows(null, null, portfolio);
        return all.stream()
                .map(Debtor::getFinancialYear)
                .distinct()
                .sorted()
                .map(year -> yearRow(year, all))
                .toList();
    }

    private YearlyDebtDto yearRow(int year, List<Debtor> all) {
        List<Debtor> debtors = all.stream()
                .filter(d -> d.getFinancialYear() == year)
                .filter(d -> DebtMath.rowTotal(d).signum() > 0)
                .toList();

        Map<String, BigDecimal> byFunding = new LinkedHashMap<>();
        for (FundingSource f : FundingSource.values()) {
            BigDecimal sum = debtors.stream()
                    .filter(d -> d.getFundingSource() == f)
                    .map(DebtMath::rowTotal)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            byFunding.put(f.name(), sum);
        }
        BigDecimal total = debtors.stream().map(DebtMath::rowTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new YearlyDebtDto(year, byFunding, total);
    }
}
