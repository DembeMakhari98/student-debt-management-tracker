package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.dto.ActivityEntryDto;
import com.adaptit.studentdebt.dto.SignalDto;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Builds the at-a-glance signal chips, evidence chips and the "as of the last scoring run"
 * system activity for a case — a direct port of the prototype's signalsOf / evidenceOf / activityOf
 * (issue #6). These are computed on read rather than persisted; see {@code CaseService} for how
 * they are combined with the persisted officer-decision audit trail.
 */
@Service
public class CaseAssemblyService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy");

    public List<SignalDto> signalsOf(Debtor d) {
        List<SignalDto> out = new ArrayList<>();
        int missed = d.getMissedInstalments() == null ? 0 : d.getMissedInstalments();
        if (missed > 0) {
            out.add(new SignalDto(missed + " missed instalment" + (missed > 1 ? "s" : ""), true));
        }
        if (d.getLastPaymentDate() == null) {
            out.add(new SignalDto("No payment on record", true));
        } else {
            out.add(new SignalDto("Last paid " + d.getLastPaymentDate().format(DATE_FMT), false));
        }
        BigDecimal d120 = AgeBucket.D120.positiveOf(d);
        BigDecimal d90 = AgeBucket.D90.positiveOf(d);
        BigDecimal arrears = DebtMath.arrears(d);
        if (d120.signum() > 0) {
            out.add(new SignalDto("120+ days " + MoneyFormat.r(d120), true));
        } else if (d90.signum() > 0) {
            out.add(new SignalDto("90 days " + MoneyFormat.r(d90), true));
        } else if (arrears.signum() > 0) {
            out.add(new SignalDto("In arrears " + MoneyFormat.r(arrears), false));
        }
        return out;
    }

    public List<SignalDto> signalsOf(Debtor d, Map<String, Integer> fundingRiskWeights) {
        List<SignalDto> out = signalsOf(d);
        int weight = fundingRiskWeights.getOrDefault(d.getFundingStatus(), 0);
        if (weight >= 8) {
            out.add(new SignalDto(d.getFundingStatus(), false));
        }
        if ("Defaulted".equalsIgnoreCase(d.getArrangementStatus())) {
            out.add(new SignalDto("Arrangement defaulted", true));
        }
        return out;
    }

    public List<String> evidenceOf(Debtor d) {
        List<String> e = new ArrayList<>();
        e.add("Ageing · " + DebtMath.oldestBucket(d).getLabel());
        e.add("Payment history " + (d.getFinancialYear() - 1) + "–" + d.getFinancialYear());
        e.add("Funding · " + d.getFundingStatus());
        if (d.getArrangementStatus() != null) {
            e.add("Arrangement · " + d.getArrangementStatus());
        }
        return e;
    }

    public List<ActivityEntryDto> activityOf(Debtor d, int score, String bandLabel) {
        List<ActivityEntryDto> a = new ArrayList<>();
        a.add(new ActivityEntryDto("Risk scored " + score + " and banded " + bandLabel,
                "Risk Sentinel · overnight run", null));
        a.add(new ActivityEntryDto("Funding status read as " + d.getFundingStatus(),
                "Funding Broker · Student Funding", null));
        int missed = d.getMissedInstalments() == null ? 0 : d.getMissedInstalments();
        if (missed > 0) {
            a.add(new ActivityEntryDto(missed + " instalment" + (missed > 1 ? "s" : "") + " flagged unpaid",
                    "Assurance Agent · Debtors", null));
        }
        a.add(new ActivityEntryDto(
                d.getLastPaymentDate() == null
                        ? "No receipt found on the account"
                        : "Last receipt " + d.getLastPaymentDate().format(DATE_FMT) + " confirmed",
                "Cashiering reconciliation", null));
        if (d.getArrangementStatus() != null) {
            a.add(new ActivityEntryDto("Prior arrangement " + d.getArrangementStatus().toLowerCase(),
                    "Assurance Agent", null));
        }
        return a;
    }
}
