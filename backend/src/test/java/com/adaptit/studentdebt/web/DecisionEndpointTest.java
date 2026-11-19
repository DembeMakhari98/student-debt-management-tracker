package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.CaseDetailDto;
import com.adaptit.studentdebt.repository.OfficerDecisionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * HTTP-level tests for POST /api/debtors/{debtorKey}/decision (issue #13, #265): an invalid
 * request must be a 400, not the 500 a raw {@code jakarta.validation.ValidationException} used to
 * produce, and an AMEND's activity entry must record both the original and the amended terms.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DecisionEndpointTest {

    private static final String DEBTOR_KEY = "STU-100301-2026"; // seeded, see CaseServiceTest

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private OfficerDecisionRepository officerDecisionRepository;

    @MockitoBean
    private com.adaptit.studentdebt.writeback.ActivityLogWriteBackAdapter adapter;

    @Test
    @WithMockUser(username = "nomsa.mahlangu", roles = "MANAGER")
    void amendWithoutAmendedTermsIsBadRequestNotAServerError() throws Exception {
        mockMvc.perform(post("/api/debtors/{debtorKey}/decision", DEBTOR_KEY)
                        .contentType("application/json")
                        .content("{\"action\":\"AMEND\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "nomsa.mahlangu", roles = "MANAGER")
    void declineWithoutAReasonIsBadRequest() throws Exception {
        mockMvc.perform(post("/api/debtors/{debtorKey}/decision", DEBTOR_KEY)
                        .contentType("application/json")
                        .content("{\"action\":\"DECLINE\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "nomsa.mahlangu", roles = "MANAGER")
    void anUnknownActionIsBadRequest() throws Exception {
        mockMvc.perform(post("/api/debtors/{debtorKey}/decision", DEBTOR_KEY)
                        .contentType("application/json")
                        .content("{\"action\":\"REJECT\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "nomsa.mahlangu", roles = "MANAGER")
    void amendRecordsBothTheOriginalAndTheAmendedTermsOnTheActivityLog() throws Exception {
        when(adapter.attemptWrite(any())).thenReturn(com.adaptit.studentdebt.writeback.WriteBackResult.ok());
        // This debtor is seeded with a decision already (012-seed-test-scenarios.xml); clear it so
        // this AMEND isn't rejected as a second decision on the same recommendation (issue #215).
        officerDecisionRepository.deleteAllByDebtorKey(DEBTOR_KEY);

        MvcResult result = mockMvc.perform(post("/api/debtors/{debtorKey}/decision", DEBTOR_KEY)
                        .contentType("application/json")
                        .content("{\"action\":\"AMEND\",\"amendedTerms\":\"[{\\\"key\\\":\\\"Instalments\\\",\\\"value\\\":\\\"4\\\"}]\"}"))
                .andExpect(status().isOk())
                .andReturn();

        CaseDetailDto detail = objectMapper.readValue(result.getResponse().getContentAsString(), CaseDetailDto.class);
        assertThat(detail.activity()).anySatisfy(a -> {
            assertThat(a.text()).contains("original terms:").contains("amended to: Instalments: 4");
            assertThat(a.source()).isEqualTo("Officer decision · nomsa.mahlangu");
        });
    }

    @Test
    @WithMockUser(username = "nomsa.mahlangu", roles = "MANAGER")
    void onlyTheFirstOfTwoApprovalsOnTheSameRecommendationSucceeds() throws Exception {
        // STU-100234-2026 has no seeded decision (see EngagementServiceTest) — both calls contend
        // for the same, still-undecided, recommendation (issue #215, #149: one final decision per
        // recommendation).
        String debtorKey = "STU-100234-2026";
        when(adapter.attemptWrite(any())).thenReturn(com.adaptit.studentdebt.writeback.WriteBackResult.ok());

        mockMvc.perform(post("/api/debtors/{debtorKey}/decision", debtorKey)
                        .contentType("application/json")
                        .content("{\"action\":\"APPROVE\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/debtors/{debtorKey}/decision", debtorKey)
                        .contentType("application/json")
                        .content("{\"action\":\"APPROVE\"}"))
                .andExpect(status().isConflict());

        assertThat(officerDecisionRepository.findAllByDebtorKeyOrderByDecidedAtDesc(debtorKey)).hasSize(1);
    }
}
