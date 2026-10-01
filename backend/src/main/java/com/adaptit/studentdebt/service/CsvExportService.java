package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.dto.DebtorRowDto;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Exports the currently filtered view to CSV (issue #17). Column order and the "Credit" band
 * override are exactly as specified in the acceptance criteria.
 */
@Service
public class CsvExportService {

    private static final String[] HEADER = {
            "Student ID", "Name", "Programme", "Funding", "Funding status", "Year", "Missed instalments",
            "Last payment", "Current", "30 days", "60 days", "90 days", "120+ days", "Balance",
            "Risk score", "Band", "Picked up by agent", "AI recommendation", "Status", "Policy"
    };

    private final DebtorQueryService debtorQueryService;
    private final RiskScoringService riskScoringService;

    public CsvExportService(DebtorQueryService debtorQueryService, RiskScoringService riskScoringService) {
        this.debtorQueryService = debtorQueryService;
        this.riskScoringService = riskScoringService;
    }

    public String export(Integer year, FundingSource funding) {
        Map<String, Integer> weights = riskScoringService.loadFundingRiskWeights();
        List<Debtor> rows = debtorQueryService.rows(year, funding);

        StringBuilder sb = new StringBuilder();
        sb.append(String.join(",", HEADER)).append('\n');

        for (Debtor d : rows) {
            DebtorRowDto row = debtorQueryService.rowFor(d);
            sb.append(String.join(",", List.of(
                    row.studentId(),
                    quote(row.name()),
                    quote(row.programme()),
                    row.fundingLabel(),
                    row.fundingStatus(),
                    String.valueOf(row.year()),
                    String.valueOf(row.missedInstalments() == null ? 0 : row.missedInstalments()),
                    row.lastPaymentDate() == null ? "none" : row.lastPaymentDate().toString(),
                    row.ageing().current().toPlainString(),
                    row.ageing().d30().toPlainString(),
                    row.ageing().d60().toPlainString(),
                    row.ageing().d90().toPlainString(),
                    row.ageing().d120().toPlainString(),
                    row.balance().toPlainString(),
                    String.valueOf(row.riskScore()),
                    row.owedToStudent() ? "Credit" : row.riskBand(),
                    row.pickedUp() ? "Yes" : "No",
                    quote(row.recommendation().action()),
                    row.recommendation().status(),
                    row.recommendation().policyClause()
            ))).append('\n');
        }
        return sb.toString();
    }

    public String fileName(Integer year, FundingSource funding) {
        String y = year == null ? "all" : year.toString();
        String f = funding == null ? "all" : funding.name().toLowerCase();
        return "student-debt-tracker-" + y + "-" + f + ".csv";
    }

    private String quote(String s) {
        return "\"" + (s == null ? "" : s.replace("\"", "\"\"")) + "\"";
    }
}
