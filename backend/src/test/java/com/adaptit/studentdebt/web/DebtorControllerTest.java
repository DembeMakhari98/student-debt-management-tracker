package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.DebtorRowDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import tools.jackson.databind.ObjectMapper;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Arrays;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies risk scoring (issue #4) against the real Liquibase-seeded data via the H2 test
 * profile — proves the full DebtorRepository -> DebtorQueryService -> RowAssembler ->
 * RiskScoringService -> DTO -> controller pipeline, not just the pure scoring function.
 */
@SpringBootTest
@AutoConfigureMockMvc
class DebtorControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void seededDebtorsScoreAccuratelyAgainstHandCalculatedExpectations() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/debtors").param("scope", "cases").param("year", "2026"))
                .andExpect(status().isOk())
                .andReturn();

        DebtorRowDto[] rows = objectMapper.readValue(result.getResponse().getContentAsString(), DebtorRowDto[].class);

        // NSFAS declined (+16) + Defaulted (+10) + no last payment (+8) + 4 missed instalments
        // (capped +22) + d90=11500 (+14) + d120=33500 (+18 + min(12, 33500/4000)) = 96, HIGH.
        DebtorRowDto highRisk = find(rows, "STU-100301-2026");
        assertEquals(96, highRisk.riskScore());
        assertEquals("HIGH", highRisk.riskBand());

        // Self-funded (+4) + 2 missed instalments (+14) + d30=8000 (+5) + d60=4000 (+8),
        // payment on record, no arrangement = 31, WATCH.
        DebtorRowDto watch = find(rows, "STU-100234-2026");
        assertEquals(31, watch.riskScore());
        assertEquals("WATCH", watch.riskBand());
    }

    private static DebtorRowDto find(DebtorRowDto[] rows, String debtorKey) {
        Optional<DebtorRowDto> match = Arrays.stream(rows)
                .filter(r -> debtorKey.equals(r.debtorKey()))
                .findFirst();
        assertTrue(match.isPresent(), "expected seeded debtor " + debtorKey + " in response");
        return match.get();
    }
}
