package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.dto.ActivityEntryDto;
import com.adaptit.studentdebt.dto.SignalDto;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Verifies signalsOf()/evidenceOf()/activityOf() against TECHNICAL_SPECIFICATION.md §4.4/§4.5/§4.6 (issue #6). */
class CaseAssemblyServiceTest {

    private final CaseAssemblyService service = new CaseAssemblyService();

    private static Debtor debtor() {
        Debtor d = new Debtor();
        d.setDebtorKey("STU-TEST-2026");
        d.setStudentId("STU-TEST");
        d.setName("Test Student");
        d.setFinancialYear(2026);
        d.setProgramme("Test Programme");
        d.setFundingStatus("Bursary confirmed");
        d.setMissedInstalments(0);
        d.setLastPaymentDate(LocalDate.of(2026, 1, 1));
        d.setAgeingCurrent(BigDecimal.ZERO);
        d.setAgeing30(BigDecimal.ZERO);
        d.setAgeing60(BigDecimal.ZERO);
        d.setAgeing90(BigDecimal.ZERO);
        d.setAgeing120(BigDecimal.ZERO);
        return d;
    }

    private static Map<String, Integer> weights() {
        return Map.of(
                "NSFAS declined", 16,
                "Bursary partial", 8,
                "Bursary confirmed", 0,
                "Self-funded", 4
        );
    }

    // ---- signalsOf: §4.4 ----

    @Test
    void zeroMissedInstalmentsProducesNoSignal() {
        Debtor d = debtor();
        List<SignalDto> signals = service.signalsOf(d, weights());
        assertTrue(signals.stream().noneMatch(s -> s.text().contains("missed instalment")));
    }

    @Test
    void oneMissedInstalmentIsSingularAndHot() {
        Debtor d = debtor();
        d.setMissedInstalments(1);
        SignalDto s = service.signalsOf(d, weights()).get(0);
        assertEquals("1 missed instalment", s.text());
        assertTrue(s.hot());
    }

    @Test
    void multipleMissedInstalmentsArePluralAndHot() {
        Debtor d = debtor();
        d.setMissedInstalments(3);
        SignalDto s = service.signalsOf(d, weights()).get(0);
        assertEquals("3 missed instalments", s.text());
        assertTrue(s.hot());
    }

    @Test
    void noPaymentOnRecordIsHot() {
        Debtor d = debtor();
        d.setLastPaymentDate(null);
        SignalDto s = firstMatching(service.signalsOf(d, weights()), "payment");
        assertEquals("No payment on record", s.text());
        assertTrue(s.hot());
    }

    @Test
    void lastPaidDateIsFormattedAndNotHot() {
        Debtor d = debtor();
        d.setLastPaymentDate(LocalDate.of(2026, 3, 1));
        SignalDto s = firstMatching(service.signalsOf(d, weights()), "paid");
        assertEquals("Last paid 01 Mar 2026", s.text());
        assertFalse(s.hot());
    }

    @Test
    void d120PresentTakesPriorityOverD90AndArrears() {
        Debtor d = debtor();
        d.setAgeing120(BigDecimal.valueOf(1000));
        d.setAgeing90(BigDecimal.valueOf(2000));
        d.setAgeing30(BigDecimal.valueOf(3000));
        List<SignalDto> signals = service.signalsOf(d, weights());
        assertTrue(signals.stream().anyMatch(s -> s.text().startsWith("120+ days") && s.hot()));
        assertTrue(signals.stream().noneMatch(s -> s.text().startsWith("90 days")));
        assertTrue(signals.stream().noneMatch(s -> s.text().startsWith("In arrears")));
    }

    @Test
    void d90PresentWithoutD120IsHot() {
        Debtor d = debtor();
        d.setAgeing90(BigDecimal.valueOf(2000));
        d.setAgeing30(BigDecimal.valueOf(3000));
        List<SignalDto> signals = service.signalsOf(d, weights());
        assertTrue(signals.stream().anyMatch(s -> s.text().startsWith("90 days") && s.hot()));
        assertTrue(signals.stream().noneMatch(s -> s.text().startsWith("In arrears")));
    }

    @Test
    void arrearsWithoutD90OrD120IsNotHot() {
        Debtor d = debtor();
        d.setAgeing30(BigDecimal.valueOf(3000));
        SignalDto s = firstMatching(service.signalsOf(d, weights()), "arrears");
        assertTrue(s.text().startsWith("In arrears"));
        assertFalse(s.hot());
    }

    @Test
    void noAgeingBucketsProducesNoAgeingSignal() {
        Debtor d = debtor();
        List<SignalDto> signals = service.signalsOf(d, weights());
        assertTrue(signals.stream().noneMatch(s ->
                s.text().startsWith("120+ days") || s.text().startsWith("90 days") || s.text().startsWith("In arrears")));
    }

    @Test
    void fundingStatusBelowWeightEightIsNotSignaled() {
        Debtor d = debtor();
        d.setFundingStatus("Self-funded"); // weight 4
        List<SignalDto> signals = service.signalsOf(d, weights());
        assertTrue(signals.stream().noneMatch(s -> s.text().equals("Self-funded")));
    }

    @Test
    void fundingStatusAtWeightEightIsSignaledAndNotHot() {
        Debtor d = debtor();
        d.setFundingStatus("Bursary partial"); // weight 8, boundary
        SignalDto s = firstMatching(service.signalsOf(d, weights()), "Bursary partial");
        assertEquals("Bursary partial", s.text());
        assertFalse(s.hot());
    }

    @Test
    void fundingStatusAboveWeightEightIsSignaled() {
        Debtor d = debtor();
        d.setFundingStatus("NSFAS declined"); // weight 16
        SignalDto s = firstMatching(service.signalsOf(d, weights()), "NSFAS declined");
        assertEquals("NSFAS declined", s.text());
    }

    @Test
    void defaultedArrangementIsSignaledHotCaseInsensitive() {
        Debtor d = debtor();
        d.setArrangementStatus("DEFAULTED");
        SignalDto s = firstMatching(service.signalsOf(d, weights()), "defaulted");
        assertEquals("Arrangement defaulted", s.text());
        assertTrue(s.hot());
    }

    @Test
    void nonDefaultedArrangementProducesNoArrangementSignal() {
        Debtor d = debtor();
        d.setArrangementStatus("Active");
        List<SignalDto> signals = service.signalsOf(d, weights());
        assertTrue(signals.stream().noneMatch(s -> s.text().contains("defaulted")));
    }

    @Test
    void fullSignalStackIsInSpecOrder() {
        Debtor d = debtor();
        d.setMissedInstalments(2);
        d.setLastPaymentDate(null);
        d.setAgeing120(BigDecimal.valueOf(5000));
        d.setFundingStatus("NSFAS declined");
        d.setArrangementStatus("Defaulted");

        List<SignalDto> signals = service.signalsOf(d, weights());

        assertEquals(5, signals.size());
        assertEquals("2 missed instalments", signals.get(0).text());
        assertEquals("No payment on record", signals.get(1).text());
        assertTrue(signals.get(2).text().startsWith("120+ days"));
        assertEquals("NSFAS declined", signals.get(3).text());
        assertEquals("Arrangement defaulted", signals.get(4).text());
    }

    // ---- evidenceOf: §4.5 ----

    @Test
    void oldestBucketFallsBackToCurrentWhenNothingOverdue() {
        Debtor d = debtor();
        List<String> evidence = service.evidenceOf(d);
        assertEquals("Ageing · Current", evidence.get(0));
    }

    @Test
    void oldestBucketReflectsOldestNonZeroBucket() {
        Debtor d = debtor();
        d.setAgeing30(BigDecimal.valueOf(100));
        d.setAgeing90(BigDecimal.valueOf(100));
        List<String> evidence = service.evidenceOf(d);
        assertEquals("Ageing · 90 days", evidence.get(0));
    }

    @Test
    void paymentHistoryUsesYearMinusOneToYearWithEnDash() {
        Debtor d = debtor();
        d.setFinancialYear(2026);
        List<String> evidence = service.evidenceOf(d);
        assertEquals("Payment history 2025–2026", evidence.get(1));
    }

    @Test
    void fundingChipAlwaysPresent() {
        Debtor d = debtor();
        d.setFundingStatus("Self-funded");
        List<String> evidence = service.evidenceOf(d);
        assertEquals("Funding · Self-funded", evidence.get(2));
    }

    @Test
    void arrangementChipPresentOnlyWhenArrangementExists() {
        Debtor d = debtor();
        assertEquals(3, service.evidenceOf(d).size());

        d.setArrangementStatus("Active");
        List<String> withArrangement = service.evidenceOf(d);
        assertEquals(4, withArrangement.size());
        assertEquals("Arrangement · Active", withArrangement.get(3));
    }

    // ---- activityOf: §4.6 ----

    @Test
    void scoreAndFundingEntriesAlwaysPresentFirst() {
        Debtor d = debtor();
        List<ActivityEntryDto> activity = service.activityOf(d, 42, "WATCH");
        assertEquals("Risk scored 42 and banded WATCH", activity.get(0).text());
        assertEquals("Risk Sentinel · overnight run", activity.get(0).source());
        assertEquals("Funding status read as Bursary confirmed", activity.get(1).text());
        assertEquals("Funding Broker · Student Funding", activity.get(1).source());
    }

    @Test
    void missedInstalmentsEntryOnlyWhenPositive() {
        Debtor d = debtor();
        d.setMissedInstalments(0);
        assertTrue(service.activityOf(d, 10, "WATCH").stream().noneMatch(a -> a.text().contains("flagged unpaid")));

        d.setMissedInstalments(2);
        ActivityEntryDto entry = service.activityOf(d, 10, "WATCH").stream()
                .filter(a -> a.text().contains("flagged unpaid")).findFirst().orElseThrow();
        assertEquals("2 instalments flagged unpaid", entry.text());
        assertEquals("Assurance Agent · Debtors", entry.source());
    }

    @Test
    void receiptEntryReflectsPaymentPresenceAndSourceIsCashiering() {
        Debtor d = debtor();
        d.setLastPaymentDate(null);
        ActivityEntryDto noReceipt = service.activityOf(d, 10, "WATCH").stream()
                .filter(a -> a.source().equals("Cashiering reconciliation")).findFirst().orElseThrow();
        assertEquals("No receipt found on the account", noReceipt.text());

        d.setLastPaymentDate(LocalDate.of(2026, 3, 1));
        ActivityEntryDto withReceipt = service.activityOf(d, 10, "WATCH").stream()
                .filter(a -> a.source().equals("Cashiering reconciliation")).findFirst().orElseThrow();
        assertEquals("Last receipt 01 Mar 2026 confirmed", withReceipt.text());
    }

    @Test
    void priorArrangementEntryOnlyWhenArrangementExistsAndIsLowercased() {
        Debtor d = debtor();
        assertTrue(service.activityOf(d, 10, "WATCH").stream().noneMatch(a -> a.text().startsWith("Prior arrangement")));

        d.setArrangementStatus("Defaulted");
        ActivityEntryDto entry = service.activityOf(d, 10, "WATCH").stream()
                .filter(a -> a.text().startsWith("Prior arrangement")).findFirst().orElseThrow();
        assertEquals("Prior arrangement defaulted", entry.text());
        assertEquals("Assurance Agent", entry.source());
    }

    @Test
    void fullActivityStackIsInSpecOrder() {
        Debtor d = debtor();
        d.setMissedInstalments(1);
        d.setLastPaymentDate(null);
        d.setArrangementStatus("Defaulted");

        List<ActivityEntryDto> activity = service.activityOf(d, 55, "ELEVATED");

        assertEquals(5, activity.size());
        assertEquals("Risk scored 55 and banded ELEVATED", activity.get(0).text());
        assertEquals("Funding status read as Bursary confirmed", activity.get(1).text());
        assertEquals("1 instalment flagged unpaid", activity.get(2).text());
        assertEquals("No receipt found on the account", activity.get(3).text());
        assertEquals("Prior arrangement defaulted", activity.get(4).text());
    }

    @Test
    void allOptionalFieldsNullOrZeroProducesNoNullTextAndOnlyUnconditionalEntries() {
        Debtor d = debtor();
        d.setLastPaymentDate(null);
        d.setArrangementStatus(null);
        d.setMissedInstalments(null);

        List<ActivityEntryDto> activity = service.activityOf(d, 1, "WATCH");
        assertEquals(3, activity.size()); // score+band, funding status, receipt (always present)
        activity.forEach(a -> assertFalse(a.text().contains("null")));

        List<SignalDto> signals = service.signalsOf(d, weights());
        signals.forEach(s -> assertFalse(s.text().contains("null")));

        List<String> evidence = service.evidenceOf(d);
        evidence.forEach(e -> assertFalse(e.contains("null")));
    }

    private static SignalDto firstMatching(List<SignalDto> signals, String needle) {
        return signals.stream().filter(s -> s.text().toLowerCase().contains(needle.toLowerCase()))
                .findFirst().orElseThrow(() -> new AssertionError("No signal containing \"" + needle + "\" in " + signals));
    }
}
