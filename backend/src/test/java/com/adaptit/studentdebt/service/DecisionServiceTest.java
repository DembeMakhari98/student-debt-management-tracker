package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.DecisionAction;
import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.domain.OfficerDecision;
import com.adaptit.studentdebt.dto.CaseDetailDto;
import com.adaptit.studentdebt.dto.DecisionRequestDto;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.OfficerDecisionRepository;
import com.adaptit.studentdebt.web.NotFoundException;
import jakarta.validation.ValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Approve / amend / decline on a case's recommendation (issue #13). */
class DecisionServiceTest {

    private final DebtorRepository debtorRepository = mock(DebtorRepository.class);
    private final OfficerDecisionRepository officerDecisionRepository = mock(OfficerDecisionRepository.class);
    private final ActivityLogEntryRepository activityLogEntryRepository = mock(ActivityLogEntryRepository.class);
    private final CaseService caseService = mock(CaseService.class);
    private final DecisionEngineService decisionEngineService = new DecisionEngineService();

    private final DecisionService decisionService = new DecisionService(
            debtorRepository, officerDecisionRepository, activityLogEntryRepository, decisionEngineService, caseService);

    private Debtor debtor;

    @BeforeEach
    void setUp() {
        debtor = new Debtor();
        debtor.setDebtorKey("STU-100234-2026");
        debtor.setStudentId("STU-100234");
        debtor.setName("Test Student");
        debtor.setFinancialYear(2026);
        debtor.setProgramme("BSc IT");
        debtor.setFundingSource(FundingSource.SELF);
        debtor.setFundingStatus("Self-funded");
        debtor.setMissedInstalments(2);
        debtor.setAgeingCurrent(BigDecimal.ZERO);
        debtor.setAgeing30(BigDecimal.valueOf(5000));
        debtor.setAgeing60(BigDecimal.ZERO);
        debtor.setAgeing90(BigDecimal.ZERO);
        debtor.setAgeing120(BigDecimal.ZERO);

        when(debtorRepository.findById("STU-100234-2026")).thenReturn(Optional.of(debtor));
        when(caseService.detailFor(any())).thenReturn(mock(CaseDetailDto.class));
    }

    @Test
    void approveSavesADecisionAndAnActivityEntryStampedWithTheOfficer() {
        decisionService.decide("STU-100234-2026", new DecisionRequestDto("APPROVE", null, null, "Nomsa Mahlangu"));

        ArgumentCaptor<OfficerDecision> captor = ArgumentCaptor.forClass(OfficerDecision.class);
        verify(officerDecisionRepository).save(captor.capture());
        OfficerDecision saved = captor.getValue();
        assertThat(saved.getAction()).isEqualTo(DecisionAction.APPROVE);
        assertThat(saved.getDecidedBy()).isEqualTo("Nomsa Mahlangu");
        assertThat(saved.getRecommendationType()).isEqualTo("PAYMENT_ARRANGEMENT");
        assertThat(saved.getDecidedAt()).isNotNull();

        verify(activityLogEntryRepository).save(any());
    }

    @Test
    void amendRequiresAmendedTerms() {
        assertThatThrownBy(() ->
                decisionService.decide("STU-100234-2026", new DecisionRequestDto("AMEND", null, null, "Nomsa Mahlangu")))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void amendWithTermsSavesTheAmendedTermsOnTheDecision() {
        decisionService.decide("STU-100234-2026",
                new DecisionRequestDto("AMEND", "6 x R 1200", null, "Nomsa Mahlangu"));

        ArgumentCaptor<OfficerDecision> captor = ArgumentCaptor.forClass(OfficerDecision.class);
        verify(officerDecisionRepository).save(captor.capture());
        assertThat(captor.getValue().getAmendedTerms()).isEqualTo("6 x R 1200");
    }

    @Test
    void declineRequiresAReason() {
        assertThatThrownBy(() ->
                decisionService.decide("STU-100234-2026", new DecisionRequestDto("DECLINE", null, "  ", "Nomsa Mahlangu")))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void declineWithAReasonSavesTheDecisionAndLogsIt() {
        decisionService.decide("STU-100234-2026",
                new DecisionRequestDto("DECLINE", null, "Student already on a verbal arrangement", "Nomsa Mahlangu"));

        ArgumentCaptor<OfficerDecision> captor = ArgumentCaptor.forClass(OfficerDecision.class);
        verify(officerDecisionRepository).save(captor.capture());
        assertThat(captor.getValue().getAction()).isEqualTo(DecisionAction.DECLINE);
        assertThat(captor.getValue().getReason()).isEqualTo("Student already on a verbal arrangement");
    }

    @Test
    void unknownActionIsRejected() {
        assertThatThrownBy(() ->
                decisionService.decide("STU-100234-2026", new DecisionRequestDto("REJECT", null, null, "Nomsa Mahlangu")))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void unknownDebtorThrowsNotFound() {
        when(debtorRepository.findById("nope")).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                decisionService.decide("nope", new DecisionRequestDto("APPROVE", null, null, "Nomsa Mahlangu")))
                .isInstanceOf(NotFoundException.class);
    }
}
