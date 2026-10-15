package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.dto.DebtorRowDto;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.web.NotFoundException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Filters the debtor book by financial year / funding source and splits it into the three
 * worklists the Tracker renders (issue #11): picked up, refund queue, paying-on-cycle.
 * Every list is narrowed to a {@link Portfolio} (issue #55); the overloads without one cover
 * every case and are for internal use.
 */
@Service
public class DebtorQueryService {

    private final DebtorRepository debtorRepository;
    private final RiskScoringService riskScoringService;
    private final RowAssembler rowAssembler;

    public DebtorQueryService(DebtorRepository debtorRepository,
                               RiskScoringService riskScoringService,
                               RowAssembler rowAssembler) {
        this.debtorRepository = debtorRepository;
        this.riskScoringService = riskScoringService;
        this.rowAssembler = rowAssembler;
    }

    /** year = null means "All years"; funding = null means "All funding types". */
    public List<Debtor> rows(Integer year, FundingSource funding) {
        return rows(year, funding, Portfolio.ALL);
    }

    public List<Debtor> rows(Integer year, FundingSource funding, Portfolio portfolio) {
        return debtorRepository.findAll().stream()
                .filter(d -> year == null || year.equals(d.getFinancialYear()))
                .filter(d -> funding == null || funding == d.getFundingSource())
                .filter(portfolio::includes)
                .toList();
    }

    public List<DebtorRowDto> pickedRows(Integer year, FundingSource funding) {
        return pickedRows(year, funding, Portfolio.ALL);
    }

    public List<DebtorRowDto> pickedRows(Integer year, FundingSource funding, Portfolio portfolio) {
        Map<String, Integer> weights = riskScoringService.loadFundingRiskWeights();
        return rows(year, funding, portfolio).stream()
                .filter(d -> DebtMath.pickedUp(d, weights))
                .map(d -> rowAssembler.toRow(d, weights))
                .sorted(Comparator.comparingInt(DebtorRowDto::riskScore).reversed())
                .toList();
    }

    public List<DebtorRowDto> refundRows(Integer year, FundingSource funding) {
        return refundRows(year, funding, Portfolio.ALL);
    }

    public List<DebtorRowDto> refundRows(Integer year, FundingSource funding, Portfolio portfolio) {
        Map<String, Integer> weights = riskScoringService.loadFundingRiskWeights();
        return rows(year, funding, portfolio).stream()
                .filter(DebtMath::owedToStudent)
                .map(d -> rowAssembler.toRow(d, weights))
                .sorted(Comparator.comparing(DebtorRowDto::balance))
                .toList();
    }

    public List<DebtorRowDto> payingRows(Integer year, FundingSource funding) {
        return payingRows(year, funding, Portfolio.ALL);
    }

    public List<DebtorRowDto> payingRows(Integer year, FundingSource funding, Portfolio portfolio) {
        Map<String, Integer> weights = riskScoringService.loadFundingRiskWeights();
        return rows(year, funding, portfolio).stream()
                .filter(d -> DebtMath.rowDebt(d).signum() > 0 && !DebtMath.pickedUp(d, weights))
                .map(d -> rowAssembler.toRow(d, weights))
                .toList();
    }

    /** Case list order: picked-up (by risk) then refunds (by credit size) — matches caseRows() in the prototype. */
    public List<DebtorRowDto> caseRows(Integer year, FundingSource funding) {
        return caseRows(year, funding, Portfolio.ALL);
    }

    public List<DebtorRowDto> caseRows(Integer year, FundingSource funding, Portfolio portfolio) {
        List<DebtorRowDto> combined = new java.util.ArrayList<>(pickedRows(year, funding, portfolio));
        combined.addAll(refundRows(year, funding, portfolio));
        return combined;
    }

    /** 404 if the case doesn't exist, 403 if it exists outside the caller's portfolio (issue #55). */
    public void requireAccess(String debtorKey, Portfolio access) {
        Debtor d = debtorRepository.findById(debtorKey)
                .orElseThrow(() -> new NotFoundException("No debtor found for " + debtorKey));
        if (!access.includes(d)) {
            throw new AccessDeniedException("Case " + debtorKey + " is outside your portfolio");
        }
    }

    public DebtorRowDto rowFor(Debtor d) {
        return rowAssembler.toRow(d, riskScoringService.loadFundingRiskWeights());
    }

    /** Picked-up or owed-to-student, across the full dataset — no year/funding filter, since a
     *  scoring run (issue #58) must not silently skip cases outside whatever filter an officer
     *  happens to have selected. Server-side mirror of the frontend's DebtService.allCases(). */
    public List<Debtor> allCaseDebtors() {
        Map<String, Integer> weights = riskScoringService.loadFundingRiskWeights();
        return rows(null, null).stream()
                .filter(d -> DebtMath.pickedUp(d, weights) || DebtMath.owedToStudent(d))
                .toList();
    }
}
