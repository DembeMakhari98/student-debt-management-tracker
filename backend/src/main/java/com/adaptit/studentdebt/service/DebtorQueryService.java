package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.dto.DebtorRowDto;
import com.adaptit.studentdebt.repository.DebtorRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Filters the debtor book by financial year / funding source and splits it into the three
 * worklists the Tracker renders (issue #11): picked up, refund queue, paying-on-cycle.
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
        return debtorRepository.findAll().stream()
                .filter(d -> year == null || year.equals(d.getFinancialYear()))
                .filter(d -> funding == null || funding == d.getFundingSource())
                .toList();
    }

    public List<DebtorRowDto> pickedRows(Integer year, FundingSource funding) {
        Map<String, Integer> weights = riskScoringService.loadFundingRiskWeights();
        return rows(year, funding).stream()
                .filter(d -> DebtMath.pickedUp(d, weights))
                .map(d -> rowAssembler.toRow(d, weights))
                .sorted(Comparator.comparingInt(DebtorRowDto::riskScore).reversed())
                .toList();
    }

    public List<DebtorRowDto> refundRows(Integer year, FundingSource funding) {
        Map<String, Integer> weights = riskScoringService.loadFundingRiskWeights();
        return rows(year, funding).stream()
                .filter(DebtMath::owedToStudent)
                .map(d -> rowAssembler.toRow(d, weights))
                .sorted(Comparator.comparing(DebtorRowDto::balance))
                .toList();
    }

    public List<DebtorRowDto> payingRows(Integer year, FundingSource funding) {
        Map<String, Integer> weights = riskScoringService.loadFundingRiskWeights();
        return rows(year, funding).stream()
                .filter(d -> DebtMath.rowDebt(d).signum() > 0 && !DebtMath.pickedUp(d, weights))
                .map(d -> rowAssembler.toRow(d, weights))
                .toList();
    }

    /** Case list order: picked-up (by risk) then refunds (by credit size) — matches caseRows() in the prototype. */
    public List<DebtorRowDto> caseRows(Integer year, FundingSource funding) {
        List<DebtorRowDto> combined = new java.util.ArrayList<>(pickedRows(year, funding));
        combined.addAll(refundRows(year, funding));
        return combined;
    }

    public DebtorRowDto rowFor(Debtor d) {
        return rowAssembler.toRow(d, riskScoringService.loadFundingRiskWeights());
    }
}
