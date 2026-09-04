package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.dto.AgeingDto;
import com.adaptit.studentdebt.dto.DebtorRowDto;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;

/** Assembles the one shared row shape used by the Tracker worklist and the case list. */
@Component
public class RowAssembler {

    private final RiskScoringService riskScoringService;
    private final DecisionEngineService decisionEngineService;
    private final CaseAssemblyService caseAssemblyService;

    public RowAssembler(RiskScoringService riskScoringService,
                         DecisionEngineService decisionEngineService,
                         CaseAssemblyService caseAssemblyService) {
        this.riskScoringService = riskScoringService;
        this.decisionEngineService = decisionEngineService;
        this.caseAssemblyService = caseAssemblyService;
    }

    public DebtorRowDto toRow(Debtor d, Map<String, Integer> fundingRiskWeights) {
        boolean owedToStudent = DebtMath.owedToStudent(d);
        BigDecimal debt = DebtMath.rowDebt(d);
        BigDecimal balance = DebtMath.rowTotal(d);
        BigDecimal credit = balance.signum() < 0 ? balance.abs() : BigDecimal.ZERO;
        int score = riskScoringService.score(d, fundingRiskWeights);
        String band = owedToStudent ? "CREDIT" : riskScoringService.bandOf(score).name();

        AgeingDto ageing = new AgeingDto(
                nz(d.getAgeingCurrent()), nz(d.getAgeing30()), nz(d.getAgeing60()), nz(d.getAgeing90()), nz(d.getAgeing120()));

        return new DebtorRowDto(
                d.getDebtorKey(),
                d.getStudentId(),
                d.getName(),
                d.getFinancialYear(),
                d.getProgramme(),
                d.getFundingSource().name(),
                d.getFundingSource().getLabel(),
                d.getFundingStatus(),
                d.getMissedInstalments(),
                d.getLastPaymentDate(),
                d.getArrangementStatus(),
                ageing,
                balance,
                debt,
                credit,
                owedToStudent,
                DebtMath.pickedUp(d, fundingRiskWeights),
                score,
                band,
                caseAssemblyService.signalsOf(d, fundingRiskWeights),
                decisionEngineService.recommend(d)
        );
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
