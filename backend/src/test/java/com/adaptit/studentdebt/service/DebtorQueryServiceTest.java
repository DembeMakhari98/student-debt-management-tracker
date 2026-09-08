package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.dto.DebtorRowDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verifies the pick-up rule (issue #5) against the real Liquibase-seeded data: no debtor may
 * appear in both the picked-up and refund worklists, and every debtor with an outstanding balance
 * lands in exactly one of the picked-up or paying-on-cycle lists.
 */
@SpringBootTest
class DebtorQueryServiceTest {

    @Autowired
    private DebtorQueryService debtorQueryService;

    @Test
    void noDebtorAppearsInBothPickedAndRefundLists() {
        Set<String> picked = keysOf(debtorQueryService.pickedRows(null, null));
        Set<String> refunds = keysOf(debtorQueryService.refundRows(null, null));

        Set<String> overlap = new HashSet<>(picked);
        overlap.retainAll(refunds);

        assertTrue(overlap.isEmpty(), "debtors in both picked and refund lists: " + overlap);
    }

    @Test
    void everyOutstandingDebtorIsEitherPickedUpOrPayingOnCycle() {
        List<Debtor> all = debtorQueryService.rows(null, null);
        Set<String> outstanding = all.stream()
                .filter(d -> DebtMath.rowDebt(d).signum() > 0)
                .map(Debtor::getDebtorKey)
                .collect(Collectors.toSet());

        Set<String> picked = keysOf(debtorQueryService.pickedRows(null, null));
        Set<String> paying = keysOf(debtorQueryService.payingRows(null, null));

        Set<String> union = new HashSet<>(picked);
        union.addAll(paying);

        assertEquals(outstanding, union);
    }

    private static Set<String> keysOf(List<DebtorRowDto> rows) {
        return rows.stream().map(DebtorRowDto::debtorKey).collect(Collectors.toSet());
    }
}
