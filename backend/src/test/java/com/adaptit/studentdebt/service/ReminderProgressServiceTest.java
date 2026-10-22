package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.PortfolioScope;
import com.adaptit.studentdebt.domain.ReminderCadenceProgress;
import com.adaptit.studentdebt.dto.ReminderProgressRowDto;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.ReminderCadenceProgressRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The read side of the reminder cadence (issue #60): scoping by portfolio (issue #55), ordering, and
 * the derived "next step" columns.
 */
class ReminderProgressServiceTest {

    private static final Instant START = Instant.parse("2026-01-01T00:00:00Z");

    private final ReminderCadenceProgressRepository progressRepository = mock(ReminderCadenceProgressRepository.class);
    private final DebtorRepository debtorRepository = mock(DebtorRepository.class);
    private final ReminderProgressService service = new ReminderProgressService(progressRepository, debtorRepository);

    private static Debtor debtor(String key, String name, String officer) {
        Debtor d = new Debtor();
        d.setDebtorKey(key);
        d.setName(name);
        d.setAssignedOfficer(officer);
        return d;
    }

    private static ReminderCadenceProgress progress(String key, Instant startedAt) {
        ReminderCadenceProgress p = new ReminderCadenceProgress();
        p.setDebtorKey(key);
        p.setStartedAt(startedAt);
        return p;
    }

    private void given(List<ReminderCadenceProgress> rows, Debtor... debtors) {
        when(progressRepository.findAll()).thenReturn(rows);
        when(debtorRepository.findAllById(anyIterable())).thenReturn(List.of(debtors));
    }

    private static Portfolio own(String officerKey) {
        return new Portfolio(PortfolioScope.OWN, Set.of(officerKey));
    }

    // ---- scoping ----

    @Test
    void ownScopeReturnsOnlyTheCallersCases() {
        given(List.of(progress("A", START), progress("B", START)),
                debtor("A", "Alice", "nomsa-mahlangu"), debtor("B", "Bob", "anele-dube"));

        assertThat(service.progress(own("nomsa-mahlangu"))).extracting(ReminderProgressRowDto::debtorKey)
                .containsExactly("A");
    }

    @Test
    void teamScopeReturnsEveryTeamMembersCases() {
        given(List.of(progress("A", START), progress("B", START), progress("C", START)),
                debtor("A", "Alice", "nomsa-mahlangu"), debtor("B", "Bob", "sibusiso-khoza"), debtor("C", "Cara", "anele-dube"));

        Portfolio team = new Portfolio(PortfolioScope.TEAM, Set.of("nomsa-mahlangu", "sibusiso-khoza"));

        assertThat(service.progress(team)).extracting(ReminderProgressRowDto::debtorKey).containsExactly("A", "B");
    }

    @Test
    void allScopeReturnsEveryCaseIncludingUnassignedOnes() {
        given(List.of(progress("A", START), progress("B", START)),
                debtor("A", "Alice", "nomsa-mahlangu"), debtor("B", "Bob", null));

        assertThat(service.progress(Portfolio.ALL)).extracting(ReminderProgressRowDto::debtorKey)
                .containsExactly("A", "B");
    }

    @Test
    void anUnassignedCaseIsHiddenFromOwnAndTeamViews() {
        given(List.of(progress("B", START)), debtor("B", "Bob", null));

        assertThat(service.progress(own("nomsa-mahlangu"))).isEmpty();
        assertThat(service.progress(new Portfolio(PortfolioScope.TEAM, Set.of("nomsa-mahlangu")))).isEmpty();
    }

    @Test
    void aRowWhoseDebtorNoLongerExistsIsLeftOutEvenForTheFullPortfolio() {
        given(List.of(progress("GONE", START), progress("A", START)), debtor("A", "Alice", "nomsa-mahlangu"));

        assertThat(service.progress(Portfolio.ALL)).extracting(ReminderProgressRowDto::debtorKey).containsExactly("A");
    }

    @Test
    void noProgressRowsGivesAnEmptyList() {
        given(List.of());

        assertThat(service.progress(Portfolio.ALL)).isEmpty();
    }

    // ---- ordering and content ----

    @Test
    void theOldestCadenceComesFirstAndTiesBreakByCaseKey() {
        given(List.of(
                        progress("C", START.plusSeconds(3 * 86400)),
                        progress("B", START),
                        progress("A", START)),
                debtor("A", "Alice", "o"), debtor("B", "Bob", "o"), debtor("C", "Cara", "o"));

        assertThat(service.progress(Portfolio.ALL)).extracting(ReminderProgressRowDto::debtorKey)
                .containsExactly("A", "B", "C");
    }

    @Test
    void aRowCarriesTheStudentNameAndOwner() {
        given(List.of(progress("A", START)), debtor("A", "Alice Smith", "nomsa-mahlangu"));

        ReminderProgressRowDto row = service.progress(Portfolio.ALL).get(0);

        assertThat(row.debtorKey()).isEqualTo("A");
        assertThat(row.studentName()).isEqualTo("Alice Smith");
        assertThat(row.assignedOfficer()).isEqualTo("nomsa-mahlangu");
        assertThat(row.startedAt()).isEqualTo(START);
    }

    // ---- derived next step ----

    @Test
    void nothingSentYetMeansStepOneIsNextAndDueOnDayOne() {
        given(List.of(progress("A", START)), debtor("A", "Alice", "o"));

        ReminderProgressRowDto row = service.progress(Portfolio.ALL).get(0);

        assertThat(row.stepsSent()).isZero();
        assertThat(row.nextStep()).isEqualTo(1);
        assertThat(row.nextStepDueAt()).isEqualTo(START.plusSeconds(1 * 86400));
    }

    @Test
    void afterStepOneStepTwoIsNextAndDueOnDayFive() {
        ReminderCadenceProgress p = progress("A", START);
        p.setStep1SentAt(START.plusSeconds(86400));
        given(List.of(p), debtor("A", "Alice", "o"));

        ReminderProgressRowDto row = service.progress(Portfolio.ALL).get(0);

        assertThat(row.stepsSent()).isEqualTo(1);
        assertThat(row.nextStep()).isEqualTo(2);
        assertThat(row.nextStepDueAt()).isEqualTo(START.plusSeconds(5 * 86400));
        assertThat(row.step1SentAt()).isEqualTo(START.plusSeconds(86400));
        assertThat(row.step2SentAt()).isNull();
    }

    @Test
    void afterStepTwoStepThreeIsNextAndDueOnDayTen() {
        ReminderCadenceProgress p = progress("A", START);
        p.setStep1SentAt(START.plusSeconds(86400));
        p.setStep2SentAt(START.plusSeconds(5 * 86400));
        given(List.of(p), debtor("A", "Alice", "o"));

        ReminderProgressRowDto row = service.progress(Portfolio.ALL).get(0);

        assertThat(row.stepsSent()).isEqualTo(2);
        assertThat(row.nextStep()).isEqualTo(3);
        assertThat(row.nextStepDueAt()).isEqualTo(START.plusSeconds(10 * 86400));
    }

    @Test
    void whenAllThreeAreSentThereIsNoNextStep() {
        ReminderCadenceProgress p = progress("A", START);
        p.setStep1SentAt(START.plusSeconds(86400));
        p.setStep2SentAt(START.plusSeconds(5 * 86400));
        p.setStep3SentAt(START.plusSeconds(10 * 86400));
        given(List.of(p), debtor("A", "Alice", "o"));

        ReminderProgressRowDto row = service.progress(Portfolio.ALL).get(0);

        assertThat(row.stepsSent()).isEqualTo(3);
        assertThat(row.nextStep()).isNull();
        assertThat(row.nextStepDueAt()).isNull();
    }
}
