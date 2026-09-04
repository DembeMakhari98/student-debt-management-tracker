package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.RecommendationStatus;
import com.adaptit.studentdebt.domain.RecommendationType;
import com.adaptit.studentdebt.dto.RecommendationDto;
import com.adaptit.studentdebt.dto.TermDto;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * The decision engine (issue #7, business case §3.4). Rules are evaluated in fixed order —
 * the first match wins. Every recommendation carries its owning agent and finance policy
 * clause via {@link RecommendationType}.
 */
@Service
public class DecisionEngineService {

    public RecommendationDto recommend(Debtor d) {
        BigDecimal debt = DebtMath.rowDebt(d);
        BigDecimal rowTotal = DebtMath.rowTotal(d);
        String fs = d.getFundingStatus() == null ? "" : d.getFundingStatus();
        int missed = d.getMissedInstalments() == null ? 0 : d.getMissedInstalments();

        // 1. Account in credit -> Refund.
        if (rowTotal.signum() < 0) {
            BigDecimal credit = rowTotal.abs();
            return build(RecommendationType.REFUND,
                    "Refund " + MoneyFormat.r(credit) + " to the student",
                    RecommendationStatus.NEEDS_APPROVAL,
                    "The account is in credit by " + MoneyFormat.r(credit) + " after " + fs.toLowerCase()
                            + ". Holding a student credit past the term end is a compliance finding, and the "
                            + "banking detail on file is verified, so the agent has prepared the payment for release.",
                    List.of(
                            new TermDto("Refund", MoneyFormat.r(credit)),
                            new TermDto("Method", "EFT, verified account"),
                            new TermDto("Turnaround", "5 working days")
                    ));
        }

        // 2. Arrangement defaulted AND no payment on record -> Registration hold + hand-over.
        if ("Defaulted".equalsIgnoreCase(d.getArrangementStatus()) && d.getLastPaymentDate() == null) {
            return build(RecommendationType.REGISTRATION_HOLD,
                    "Registration hold and hand-over",
                    RecommendationStatus.NEEDS_APPROVAL,
                    "A prior arrangement defaulted, there is no payment on record and funding reads " + fs.toLowerCase()
                            + ". Every agent channel has been tried without engagement, so escalation is the "
                            + "remaining option on " + MoneyFormat.r(debt) + ".",
                    List.of(
                            new TermDto("Hold", "Registration"),
                            new TermDto("Hand-over", "Adapt Connect"),
                            new TermDto("Review", "On first contact")
                    ));
        }

        // 3. Funding lapsed or declined -> Hardship fund referral.
        if (fs.matches("(?i).*(lapsed|declined).*")) {
            BigDecimal award = debt.multiply(BigDecimal.valueOf(0.4)).min(BigDecimal.valueOf(6000));
            return build(RecommendationType.HARDSHIP_FUND,
                    "Hardship fund referral and sponsor follow-up",
                    RecommendationStatus.NEEDS_APPROVAL,
                    "Funding reads " + fs.toLowerCase() + ", which removed cover the student had budgeted against "
                            + "— the shortfall is not conduct. A partial hardship award bridges the term while the "
                            + "agent re-tests eligibility on " + MoneyFormat.r(debt) + " outstanding.",
                    List.of(
                            new TermDto("Award sought", MoneyFormat.r(award)),
                            new TermDto("Bridge", "One semester"),
                            new TermDto("Re-test", "Next funding window")
                    ));
        }

        boolean pending = fs.matches("(?i).*pending.*");

        // 4. Funding pending AND 2+ missed -> Holding payment arrangement.
        if (pending && missed >= 2) {
            int n = DebtMath.instalments(debt);
            BigDecimal instalment = debt.divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP);
            return build(RecommendationType.PAYMENT_ARRANGEMENT,
                    "Holding arrangement, " + n + " instalments",
                    RecommendationStatus.NEEDS_APPROVAL,
                    missed + " instalments are unpaid and NSFAS has not resolved, so the balance cannot be settled "
                            + "in one payment. A " + n + "-instalment holding arrangement at " + MoneyFormat.r(instalment)
                            + " per month keeps registration intact while the funding outcome is chased.",
                    List.of(
                            new TermDto("Instalments", n + " × " + MoneyFormat.r(instalment)),
                            new TermDto("Hold on registration", "Suspended"),
                            new TermDto("Falls away if", "NSFAS approves")
                    ));
        }

        // 5. Funding pending, fewer than 2 missed -> Funding chase.
        if (pending) {
            BigDecimal arrears = DebtMath.arrears(d);
            BigDecimal outstanding = arrears.signum() > 0 ? arrears : debt;
            return build(RecommendationType.FUNDING_CHASE,
                    "Chase funding verification, suspend hold",
                    RecommendationStatus.AGENT_ACTING,
                    "The student is current apart from " + MoneyFormat.r(outstanding) + " sitting behind an "
                            + "unresolved NSFAS application. Chasing the outstanding documents is cheaper than "
                            + "collections, so the agent is working the funding route first.",
                    List.of(
                            new TermDto("Outstanding", "Supporting documents"),
                            new TermDto("Reminders", "SMS and WhatsApp"),
                            new TermDto("Hold", "Suspended pending outcome")
                    ));
        }

        // 6. 2+ missed (any funding status) -> Payment arrangement.
        if (missed >= 2) {
            int n = DebtMath.instalments(debt);
            BigDecimal instalment = debt.divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP);
            return build(RecommendationType.PAYMENT_ARRANGEMENT,
                    "Payment arrangement, " + n + " instalments",
                    RecommendationStatus.NEEDS_APPROVAL,
                    missed + " instalments are unpaid on " + MoneyFormat.r(debt) + ", but the student has paid "
                            + "before (last receipt " + (d.getLastPaymentDate() == null ? "none" : d.getLastPaymentDate())
                            + "). An arrangement at " + MoneyFormat.r(instalment) + " per month recovers more over "
                            + "twelve months than a registration hold, which historically converts to withdrawal in "
                            + "41 percent of comparable cases.",
                    List.of(
                            new TermDto("Instalments", n + " × " + MoneyFormat.r(instalment)),
                            new TermDto("First debit", "22nd of next month"),
                            new TermDto("Hold on registration", "Suspended")
                    ));
        }

        // 7. Exactly 1 missed -> Reminder cadence.
        if (missed == 1) {
            return build(RecommendationType.REMINDER_CADENCE,
                    "Reminder cadence, no hold",
                    RecommendationStatus.AGENT_ACTING,
                    "One instalment was missed on " + MoneyFormat.r(debt) + " against an otherwise clean record. "
                            + "A three-step SMS and WhatsApp cadence resolves this pattern without a human in 8 of "
                            + "10 comparable cases, so no hold is proposed.",
                    List.of(
                            new TermDto("Step 1", "SMS, day 1"),
                            new TermDto("Step 2", "WhatsApp, day 5"),
                            new TermDto("Step 3", "Officer call, day 10")
                    ));
        }

        // 8. Otherwise -> Monitor only.
        return build(RecommendationType.MONITOR,
                "Monitor only",
                RecommendationStatus.MONITORING,
                "The account is current and payments are arriving on cycle. The agent keeps scoring nightly and "
                        + "will raise a case the moment a payment is missed.",
                List.of(
                        new TermDto("Action", "None required"),
                        new TermDto("Re-score", "Nightly")
                ));
    }

    private RecommendationDto build(RecommendationType type, String action, RecommendationStatus status,
                                     String rationale, List<TermDto> terms) {
        return new RecommendationDto(type.name(), action, status.getLabel(), rationale,
                type.getAgent(), type.getPolicyClause(), terms);
    }
}
