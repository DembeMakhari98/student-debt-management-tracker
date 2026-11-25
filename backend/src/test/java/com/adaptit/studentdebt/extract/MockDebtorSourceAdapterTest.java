package com.adaptit.studentdebt.extract;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** The demonstration book's Student Numbers (issue #305). */
class MockDebtorSourceAdapterTest {

    private final List<ExtractedDebtor> rows = new MockDebtorSourceAdapter().extractDebtors();

    @Test
    void everyDebtorHasANineDigitStudentNumber() {
        assertThat(rows).isNotEmpty().allSatisfy(r ->
                assertThat(r.studentNumber()).as(r.studentId()).matches("\\d{9}"));
    }

    @Test
    void studentNumbersAreUniquePerStudentAndSomeKeepALeadingZero() {
        assertThat(rows.stream().map(ExtractedDebtor::studentNumber).distinct().count())
                .isEqualTo(rows.stream().map(ExtractedDebtor::studentId).distinct().count());
        assertThat(rows).anySatisfy(r -> assertThat(r.studentNumber()).startsWith("0"));
    }
}
