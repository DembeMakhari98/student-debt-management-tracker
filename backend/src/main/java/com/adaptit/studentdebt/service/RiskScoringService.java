package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.FundingStatusRiskWeight;
import com.adaptit.studentdebt.domain.RiskBand;
import com.adaptit.studentdebt.repository.FundingStatusRiskWeightRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Nightly risk scoring (issue #4, business case §3.3). A debtor with no outstanding balance
 * always scores 0. The score is capped to 1–99 and banded Watch / Elevated / High.
 */
@Service
public class RiskScoringService {

    private final FundingStatusRiskWeightRepository riskWeightRepository;

    public RiskScoringService(FundingStatusRiskWeightRepository riskWeightRepository) {
        this.riskWeightRepository = riskWeightRepository;
    }

    /** The full funding-status → risk-weight lookup, cheap enough to reload per request for a reference build. */
    public Map<String, Integer> loadFundingRiskWeights() {
        return riskWeightRepository.findAll().stream()
                .collect(Collectors.toMap(FundingStatusRiskWeight::getFundingStatus, FundingStatusRiskWeight::getRiskWeight));
    }

    public int score(Debtor d, Map<String, Integer> fundingRiskWeights) {
        if (DebtMath.rowDebt(d).signum() <= 0) {
            return 0;
        }
        double s = 0;
        double d120 = AgeBucket.D120.positiveOf(d).doubleValue();
        double d90 = AgeBucket.D90.positiveOf(d).doubleValue();
        double d60 = AgeBucket.D60.positiveOf(d).doubleValue();
        double d30 = AgeBucket.D30.positiveOf(d).doubleValue();

        if (d120 > 0) s += 18 + Math.min(12, d120 / 4000.0);
        if (d90 > 0) s += 14;
        if (d60 > 0) s += 8;
        if (d30 > 0) s += 5;

        int missed = d.getMissedInstalments() == null ? 0 : d.getMissedInstalments();
        s += Math.min(22, missed * 7.0);

        s += fundingRiskWeights.getOrDefault(d.getFundingStatus(), 0);

        if ("Defaulted".equalsIgnoreCase(d.getArrangementStatus())) s += 10;
        if (d.getLastPaymentDate() == null) s += 8;

        return (int) Math.max(1, Math.min(99, Math.round(s)));
    }

    public RiskBand bandOf(int score) {
        if (score >= 70) return RiskBand.HIGH;
        if (score >= 45) return RiskBand.ELEVATED;
        return RiskBand.WATCH;
    }
}
