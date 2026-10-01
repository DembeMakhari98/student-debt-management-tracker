package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.dto.SummaryDto;
import com.adaptit.studentdebt.repository.RegisteredCountRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/** The 5 KPI cards shared by Home and the Tracker (issue #10). */
@Service
public class SummaryService {

    private final DebtorQueryService debtorQueryService;
    private final RegisteredCountRepository registeredCountRepository;

    public SummaryService(DebtorQueryService debtorQueryService, RegisteredCountRepository registeredCountRepository) {
        this.debtorQueryService = debtorQueryService;
        this.registeredCountRepository = registeredCountRepository;
    }

    public SummaryDto summarize(Integer year, FundingSource funding) {
        List<Debtor> rows = debtorQueryService.rows(year, funding);

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
}
