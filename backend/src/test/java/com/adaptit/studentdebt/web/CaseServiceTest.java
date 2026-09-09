package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.ActivityEntryDto;
import com.adaptit.studentdebt.dto.CaseDetailDto;
import com.adaptit.studentdebt.dto.DebtorRowDto;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.service.MoneyFormat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies signals/evidence/activity (issue #6) against the real Liquibase-seeded data via the
 * H2 test profile — proves the full real-data pipeline, not just the pure CaseAssemblyService
 * functions, and proves the activity log read path never writes (append-only, §4.6 AC4).
 */
@SpringBootTest
@AutoConfigureMockMvc
class CaseServiceTest {

    private static final String DEBTOR_KEY = "STU-100301-2026";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ActivityLogEntryRepository activityLogEntryRepository;

    @Test
    void seededDebtorSignalsMatchHandDerivedExpectations() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/debtors").param("scope", "cases").param("year", "2026"))
                .andExpect(status().isOk())
                .andReturn();
        DebtorRowDto[] rows = objectMapper.readValue(result.getResponse().getContentAsString(), DebtorRowDto[].class);
        DebtorRowDto row = find(rows, DEBTOR_KEY);

        // NSFAS declined (weight 16), 4 missed instalments, no last payment, d120=33500, Defaulted.
        assertEquals(5, row.signals().size());
        assertEquals("4 missed instalments", row.signals().get(0).text());
        assertEquals("No payment on record", row.signals().get(1).text());
        assertEquals("120+ days " + MoneyFormat.r(BigDecimal.valueOf(33500)), row.signals().get(2).text());
        assertEquals("NSFAS declined", row.signals().get(3).text());
        assertEquals("Arrangement defaulted", row.signals().get(4).text());
        assertTrue(row.signals().get(0).hot());
        assertTrue(row.signals().get(4).hot());
    }

    @Test
    void seededDebtorEvidenceAndActivityMatchHandDerivedExpectations() throws Exception {
        CaseDetailDto detail = detailFor(DEBTOR_KEY);

        assertEquals(List.of(
                "Ageing · 120+ days",
                "Payment history 2025–2026",
                "Funding · NSFAS declined",
                "Arrangement · Defaulted"
        ), detail.evidence());

        // First 5 entries are computed live on every read (§4.6, rules 1-5); the 6th is the
        // persisted "Nightly extract loaded..." seed entry (004-seed-activity-log.xml).
        List<ActivityEntryDto> activity = detail.activity();
        assertEquals(6, activity.size());
        assertEquals("Risk scored 96 and banded HIGH", activity.get(0).text());
        assertEquals("Risk Sentinel · overnight run", activity.get(0).source());
        assertEquals("Funding status read as NSFAS declined", activity.get(1).text());
        assertEquals("4 instalments flagged unpaid", activity.get(2).text());
        assertEquals("No receipt found on the account", activity.get(3).text());
        assertEquals("Prior arrangement defaulted", activity.get(4).text());
        assertEquals("Nightly extract loaded from Debtors, Student Fees and Cashiering", activity.get(5).text());
        assertEquals("Debt Tracker Service · nightly extract", activity.get(5).source());
    }

    @Test
    void readingCaseDetailTwiceDoesNotDuplicatePersistedActivityLogEntries() throws Exception {
        long before = activityLogEntryRepository.findAllByDebtorKeyOrderByCreatedAtDesc(DEBTOR_KEY).size();

        detailFor(DEBTOR_KEY);
        detailFor(DEBTOR_KEY);

        long after = activityLogEntryRepository.findAllByDebtorKeyOrderByCreatedAtDesc(DEBTOR_KEY).size();
        assertEquals(before, after, "reading case detail must never write to the persisted activity log");
    }

    private CaseDetailDto detailFor(String debtorKey) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/debtors/{debtorKey}", debtorKey))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readValue(result.getResponse().getContentAsString(), CaseDetailDto.class);
    }

    private static DebtorRowDto find(DebtorRowDto[] rows, String debtorKey) {
        Optional<DebtorRowDto> match = Arrays.stream(rows)
                .filter(r -> debtorKey.equals(r.debtorKey()))
                .findFirst();
        assertTrue(match.isPresent(), "expected seeded debtor " + debtorKey + " in response");
        return match.get();
    }
}
