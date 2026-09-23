package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.dto.RecommendationDto;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the autonomy gate (issue #8, technical spec §5.10). No Spring context needed —
 * neither {@link AutonomyGateService} nor {@link DecisionEngineService} has injected dependencies.
 */
class AutonomyGateServiceTest {

    private final DecisionEngineService engine = new DecisionEngineService();
    private final AutonomyGateService gate = new AutonomyGateService();

    private static Debtor debtor() {
        Debtor d = new Debtor();
        d.setDebtorKey("STU-TEST-2026");
        d.setStudentId("STU-TEST");
        d.setName("Test Student");
        d.setFinancialYear(2026);
        d.setProgramme("Test Programme");
        d.setFundingSource(FundingSource.SELF);
        d.setFundingStatus("Self-funded");
        d.setMissedInstalments(0);
        d.setLastPaymentDate(LocalDate.of(2026, 1, 1));
        d.setArrangementStatus(null);
        d.setAgeingCurrent(BigDecimal.ZERO);
        d.setAgeing30(BigDecimal.ZERO);
        d.setAgeing60(BigDecimal.ZERO);
        d.setAgeing90(BigDecimal.ZERO);
        d.setAgeing120(BigDecimal.ZERO);
        return d;
    }

    private static Debtor refundFixture() {
        Debtor d = debtor();
        d.setAgeingCurrent(BigDecimal.valueOf(-4200));
        return d;
    }

    private static Debtor registrationHoldFixture() {
        Debtor d = debtor();
        d.setArrangementStatus("Defaulted");
        d.setLastPaymentDate(null);
        d.setMissedInstalments(4);
        return d;
    }

    private static Debtor hardshipFundFixture() {
        Debtor d = debtor();
        d.setFundingStatus("NSFAS lapsed");
        d.setAgeing120(BigDecimal.valueOf(20000));
        return d;
    }

    private static Debtor holdingArrangementFixture() {
        Debtor d = debtor();
        d.setFundingStatus("NSFAS pending");
        d.setMissedInstalments(2);
        d.setAgeingCurrent(BigDecimal.valueOf(12000));
        return d;
    }

    private static Debtor fundingChaseFixture() {
        Debtor d = debtor();
        d.setFundingStatus("NSFAS pending");
        d.setMissedInstalments(1);
        d.setAgeingCurrent(BigDecimal.valueOf(12000));
        return d;
    }

    private static Debtor paymentArrangementFixture() {
        Debtor d = debtor();
        d.setFundingStatus("Self-funded");
        d.setMissedInstalments(2);
        d.setAgeingCurrent(BigDecimal.valueOf(12000));
        return d;
    }

    private static Debtor reminderCadenceFixture() {
        Debtor d = debtor();
        d.setFundingStatus("Self-funded");
        d.setMissedInstalments(1);
        return d;
    }

    private static Debtor monitorFixture() {
        return debtor();
    }

    @Test
    void autoEligible_level1and2_neverEligibleForAnyRule() {
        Debtor[] fixtures = {
                refundFixture(), registrationHoldFixture(), hardshipFundFixture(), holdingArrangementFixture(),
                fundingChaseFixture(), paymentArrangementFixture(), reminderCadenceFixture(), monitorFixture(),
        };
        assertAll(() -> {
            for (Debtor d : fixtures) {
                RecommendationDto rec = engine.recommend(d);
                assertFalse(gate.autoEligible(rec, 1), rec.type() + " @ level 1");
                assertFalse(gate.autoEligible(rec, 2), rec.type() + " @ level 2");
            }
        });
    }

    @Test
    void autoEligible_level3_onlyAgentActingRulesAreEligible() {
        assertAll(
                () -> assertFalse(gate.autoEligible(engine.recommend(refundFixture()), 3), "Refund @ level 3"),
                () -> assertFalse(gate.autoEligible(engine.recommend(registrationHoldFixture()), 3), "Registration hold @ level 3"),
                () -> assertFalse(gate.autoEligible(engine.recommend(hardshipFundFixture()), 3), "Hardship fund @ level 3"),
                () -> assertFalse(gate.autoEligible(engine.recommend(holdingArrangementFixture()), 3), "Holding arrangement @ level 3"),
                () -> assertTrue(gate.autoEligible(engine.recommend(fundingChaseFixture()), 3), "Funding chase @ level 3"),
                () -> assertFalse(gate.autoEligible(engine.recommend(paymentArrangementFixture()), 3), "Payment arrangement @ level 3"),
                () -> assertTrue(gate.autoEligible(engine.recommend(reminderCadenceFixture()), 3), "Reminder cadence @ level 3"),
                () -> assertFalse(gate.autoEligible(engine.recommend(monitorFixture()), 3), "Monitor @ level 3")
        );
    }

    @Test
    void autoEligible_level4_everyRuleEligibleExceptTheHardManualTypes() {
        assertAll(
                () -> assertFalse(gate.autoEligible(engine.recommend(refundFixture()), 4), "Refund @ level 4 — hard rule"),
                () -> assertFalse(gate.autoEligible(engine.recommend(registrationHoldFixture()), 4), "Registration hold @ level 4 — hard rule"),
                () -> assertTrue(gate.autoEligible(engine.recommend(hardshipFundFixture()), 4), "Hardship fund @ level 4"),
                () -> assertTrue(gate.autoEligible(engine.recommend(holdingArrangementFixture()), 4), "Holding arrangement @ level 4"),
                () -> assertTrue(gate.autoEligible(engine.recommend(fundingChaseFixture()), 4), "Funding chase @ level 4"),
                () -> assertTrue(gate.autoEligible(engine.recommend(paymentArrangementFixture()), 4), "Payment arrangement @ level 4"),
                () -> assertTrue(gate.autoEligible(engine.recommend(reminderCadenceFixture()), 4), "Reminder cadence @ level 4"),
                () -> assertFalse(gate.autoEligible(engine.recommend(monitorFixture()), 4), "Monitor @ level 4 — nothing to execute")
        );
    }

    @Test
    void autoEligible_hardRule_blocksRefundAndRegistrationHoldAtEveryLevel() {
        RecommendationDto refund = engine.recommend(refundFixture());
        RecommendationDto hold = engine.recommend(registrationHoldFixture());

        assertAll(() -> {
            for (int level = 1; level <= 4; level++) {
                assertFalse(gate.autoEligible(refund, level), "Refund @ level " + level);
                assertFalse(gate.autoEligible(hold, level), "Registration hold @ level " + level);
            }
        });
    }
}
