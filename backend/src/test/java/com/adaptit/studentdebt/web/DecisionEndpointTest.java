package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.CaseDetailDto;
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
}
