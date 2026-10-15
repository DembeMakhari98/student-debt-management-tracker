package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.dto.AutoResolveResultDto;
import com.adaptit.studentdebt.dto.DecisionRequestDto;
import com.adaptit.studentdebt.repository.OfficerDecisionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The server-side scoring run (issue #58) — orchestration around already-tested pieces
 * ({@link AutonomyGateServiceTest} already covers the full 32-case gating truth table).
 */
class AutoResolveServiceTest {

    private final DebtorQueryService debtorQueryService = mock(DebtorQueryService.class);
    private final DecisionEngineService decisionEngineService = new DecisionEngineService();
    private final AutonomyGateService autonomyGateService = new AutonomyGateService();
    private final AutonomySettingService autonomySettingService = mock(AutonomySettingService.class);
    private final OfficerDecisionRepository officerDecisionRepository = mock(OfficerDecisionRepository.class);
    private final DecisionService decisionService = mock(DecisionService.class);

    private final AutoResolveService service = new AutoResolveService(
            debtorQueryService, decisionEngineService, autonomyGateService, autonomySettingService,
            officerDecisionRepository, decisionService);

    private Debtor reminderCadenceFixture;  // Agent acting
    private Debtor paymentArrangementFixture;  // Needs approval
    private Debtor refundFixture;  // hard rule
    private Debtor registrationHoldFixture;  // hard rule

    private static Debtor debtor(String key) {
        Debtor d = new Debtor();
        d.setDebtorKey(key);
        d.setStudentId(key);
        d.setName("Test Student " + key);
        d.setFinancialYear(2026);
        d.setProgramme("Test Programme");
        d.setFundingSource(FundingSource.SELF);
        d.setFundingStatus("Self-funded");
        d.setMissedInstalments(0);
        d.setLastPaymentDate(LocalDate.of(2026, 1, 1));
        d.setAgeingCurrent(BigDecimal.ZERO);
        d.setAgeing30(BigDecimal.ZERO);
        d.setAgeing60(BigDecimal.ZERO);
        d.setAgeing90(BigDecimal.ZERO);
        d.setAgeing120(BigDecimal.ZERO);
        return d;
    }

    @BeforeEach
    void setUp() {
        reminderCadenceFixture = debtor("STU-CADENCE-2026");
        reminderCadenceFixture.setMissedInstalments(1);

        paymentArrangementFixture = debtor("STU-ARRANGEMENT-2026");
        paymentArrangementFixture.setMissedInstalments(2);
        paymentArrangementFixture.setAgeingCurrent(BigDecimal.valueOf(12000));

        refundFixture = debtor("STU-REFUND-2026");
        refundFixture.setAgeingCurrent(BigDecimal.valueOf(-4200));

        registrationHoldFixture = debtor("STU-HOLD-2026");
        registrationHoldFixture.setArrangementStatus("Defaulted");
        registrationHoldFixture.setLastPaymentDate(null);
        registrationHoldFixture.setMissedInstalments(4);

        when(officerDecisionRepository.findFirstByDebtorKeyAndRecommendationTypeOrderByDecidedAtDesc(anyString(), anyString()))
                .thenReturn(Optional.empty());
    }

    @Test
    void level1And2ResolveNothing() {
        when(autonomySettingService.currentLevel()).thenReturn(1);
        when(debtorQueryService.allCaseDebtors()).thenReturn(
                List.of(reminderCadenceFixture, paymentArrangementFixture, refundFixture, registrationHoldFixture));

        AutoResolveResultDto result = service.autoResolve();

        assertThat(result.resolvedCount()).isZero();
        assertThat(result.debtorKeys()).isEmpty();
        verify(decisionService, never()).decide(anyString(), any());
    }

    @Test
    void level3ResolvesOnlyAgentActingCases() {
        when(autonomySettingService.currentLevel()).thenReturn(3);
        when(debtorQueryService.allCaseDebtors()).thenReturn(
                List.of(reminderCadenceFixture, paymentArrangementFixture, refundFixture, registrationHoldFixture));

        AutoResolveResultDto result = service.autoResolve();

        assertThat(result.debtorKeys()).containsExactly("STU-CADENCE-2026");
        verify(decisionService).decide(eq("STU-CADENCE-2026"), eq(new DecisionRequestDto("APPROVE", null, null, "Autonomous Agent")));
        verify(decisionService, never()).decide(eq("STU-ARRANGEMENT-2026"), any());
    }

    @Test
    void level4ResolvesEveryCaseExceptTheHardRuleTypes() {
        when(autonomySettingService.currentLevel()).thenReturn(4);
        when(debtorQueryService.allCaseDebtors()).thenReturn(
                List.of(reminderCadenceFixture, paymentArrangementFixture, refundFixture, registrationHoldFixture));

        AutoResolveResultDto result = service.autoResolve();

        assertThat(result.debtorKeys()).containsExactlyInAnyOrder("STU-CADENCE-2026", "STU-ARRANGEMENT-2026");
        verify(decisionService, never()).decide(eq("STU-REFUND-2026"), any());
        verify(decisionService, never()).decide(eq("STU-HOLD-2026"), any());
    }

    @Test
    void anAlreadyDecidedCaseIsSkippedEvenWhenEligible() {
        when(autonomySettingService.currentLevel()).thenReturn(4);
        when(debtorQueryService.allCaseDebtors()).thenReturn(List.of(reminderCadenceFixture));
        when(officerDecisionRepository.findFirstByDebtorKeyAndRecommendationTypeOrderByDecidedAtDesc(
                "STU-CADENCE-2026", "REMINDER_CADENCE"))
                .thenReturn(Optional.of(mock(com.adaptit.studentdebt.domain.OfficerDecision.class)));

        AutoResolveResultDto result = service.autoResolve();

        assertThat(result.resolvedCount()).isZero();
        verify(decisionService, never()).decide(anyString(), any());
    }
}
