package com.adaptit.studentdebt.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Locks in en-ZA's actual thousands separator (issue #275): a space, not a comma. The Technical
 * Specification's own illustrative example used a comma, which doesn't match how {@code en-ZA}
 * really formats numbers — this test exists so nobody "fixes" {@link MoneyFormat} to match that
 * incorrect example.
 */
class MoneyFormatTest {

    @Test
    void groupsThousandsWithASpaceNotAComma() {
        assertThat(MoneyFormat.r(BigDecimal.valueOf(12000))).doesNotContain(",").contains("12").contains("000");
    }

    @Test
    void roundsToTheNearestRand() {
        assertThat(MoneyFormat.r(BigDecimal.valueOf(1200.6))).isEqualTo(MoneyFormat.r(BigDecimal.valueOf(1201)));
    }

    @Test
    void prefixesWithAnRAndASpace() {
        assertThat(MoneyFormat.r(BigDecimal.valueOf(500))).startsWith("R ");
    }
}
