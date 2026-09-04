package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.dto.AgeingDto;
import com.adaptit.studentdebt.dto.AgeingResponseDto;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Builds the Age Analysis workspace's four panels (issue #15). */
@Service
public class AgeingService {

    private final DebtorQueryService debtorQueryService;

    public AgeingService(DebtorQueryService debtorQueryService) {
        this.debtorQueryService = debtorQueryService;
    }

    public AgeingResponseDto build(Integer year, FundingSource funding) {
        List<Debtor> rows = debtorQueryService.rows(year, funding);

        AgeingDto bucketTotals = sumBuckets(rows);

        Map<String, AgeingDto> byFunding = new LinkedHashMap<>();
        for (FundingSource f : FundingSource.values()) {
            List<Debtor> forFund = rows.stream().filter(d -> d.getFundingSource() == f).toList();
            byFunding.put(f.name(), sumBuckets(forFund));
        }

        List<AgeingResponseDto.StudentAgeingRowDto> students = rows.stream()
                .filter(d -> DebtMath.rowDebt(d).signum() > 0)
                .sorted((a, b) -> {
                    int c = AgeBucket.D120.positiveOf(b).compareTo(AgeBucket.D120.positiveOf(a));
                    if (c != 0) return c;
                    c = AgeBucket.D90.positiveOf(b).compareTo(AgeBucket.D90.positiveOf(a));
                    if (c != 0) return c;
                    return DebtMath.rowDebt(b).compareTo(DebtMath.rowDebt(a));
                })
                .map(d -> new AgeingResponseDto.StudentAgeingRowDto(
                        d.getStudentId(), d.getName(), d.getFinancialYear(),
                        d.getFundingSource().name(), d.getFundingSource().getLabel(),
                        rowAgeing(d), DebtMath.rowDebt(d), DebtMath.oldestBucket(d).getLabel()))
                .toList();

        List<Debtor> creditDebtors = rows.stream().filter(DebtMath::owedToStudent).toList();
        List<AgeingResponseDto.CreditAgeingRowDto> credits = creditDebtors.stream()
                .sorted((a, b) -> Integer.compare(daysOwing(b), daysOwing(a)))
                .map(d -> new AgeingResponseDto.CreditAgeingRowDto(
                        d.getStudentId(), d.getName(), d.getFinancialYear(),
                        d.getFundingSource().name(), d.getFundingSource().getLabel(),
                        d.getCreditReason(), d.getCreditSince(), daysOwing(d), daysBandLabel(daysOwing(d)),
                        DebtMath.rowTotal(d).abs()))
                .toList();

        List<Debtor> stale = creditDebtors.stream().filter(d -> daysOwing(d) > 90).toList();
        BigDecimal staleTotal = stale.stream().map(d -> DebtMath.rowTotal(d).abs()).reduce(BigDecimal.ZERO, BigDecimal::add);

        return new AgeingResponseDto(bucketTotals, byFunding, students, credits, staleTotal, stale.size());
    }

    private AgeingDto sumBuckets(List<Debtor> rows) {
        Map<AgeBucket, BigDecimal> totals = new EnumMap<>(AgeBucket.class);
        for (AgeBucket b : AgeBucket.values()) {
            totals.put(b, rows.stream().map(b::positiveOf).reduce(BigDecimal.ZERO, BigDecimal::add));
        }
        return new AgeingDto(totals.get(AgeBucket.CURRENT), totals.get(AgeBucket.D30),
                totals.get(AgeBucket.D60), totals.get(AgeBucket.D90), totals.get(AgeBucket.D120));
    }

    private AgeingDto rowAgeing(Debtor d) {
        return new AgeingDto(AgeBucket.CURRENT.positiveOf(d), AgeBucket.D30.positiveOf(d),
                AgeBucket.D60.positiveOf(d), AgeBucket.D90.positiveOf(d), AgeBucket.D120.positiveOf(d));
    }

    private int daysOwing(Debtor d) {
        if (d.getCreditDays() != null) return d.getCreditDays();
        if (d.getCreditSince() != null) return (int) ChronoUnit.DAYS.between(d.getCreditSince(), LocalDate.now());
        return 0;
    }

    /** Credits age exactly like a debt does — same bucket boundaries, keyed by days rather than Rand. */
    private String daysBandLabel(int days) {
        if (days > 120) return AgeBucket.D120.getLabel();
        if (days > 90) return AgeBucket.D90.getLabel();
        if (days > 60) return AgeBucket.D60.getLabel();
        if (days > 30) return AgeBucket.D30.getLabel();
        return AgeBucket.CURRENT.getLabel();
    }
}
