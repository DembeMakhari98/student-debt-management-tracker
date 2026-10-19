package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.ActivityEntryDto;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.writeback.ActivityLogWriteBackAdapter;
import com.adaptit.studentdebt.writeback.WriteBackResult;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP-level tests for POST /api/debtors/{debtorKey}/engagements (issue #59). */
@SpringBootTest
@AutoConfigureMockMvc
class EngagementEndpointTest {

    private static final String DEBTOR_KEY = "STU-100301-2026"; // seeded, see CaseServiceTest

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private ActivityLogEntryRepository activityLogEntryRepository;

    @MockitoBean
    private ActivityLogWriteBackAdapter adapter;

    @Test
    @WithMockUser(username = "nomsa.mahlangu", roles = "MANAGER")
    void aCallerWithPortfolioAccessCanRecordAnSmsEngagement() throws Exception {
        when(adapter.attemptWrite(any())).thenReturn(WriteBackResult.ok());
        int before = activityLogEntryRepository.findAllByDebtorKeyOrderByCreatedAtDesc(DEBTOR_KEY).size();

        MvcResult result = mockMvc.perform(post("/api/debtors/{debtorKey}/engagements", DEBTOR_KEY)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new com.adaptit.studentdebt.dto.EngagementRequestDto("SMS", null))))
                .andExpect(status().isOk())
                .andReturn();

        ActivityEntryDto[] activity =
                objectMapper.readValue(result.getResponse().getContentAsString(), ActivityEntryDto[].class);
        assertThat(activity).anySatisfy(a -> {
            assertThat(a.text()).isEqualTo("SMS sent to student");
            assertThat(a.source()).isEqualTo("Engagement Agent · nomsa.mahlangu");
        });

        int after = activityLogEntryRepository.findAllByDebtorKeyOrderByCreatedAtDesc(DEBTOR_KEY).size();
        assertThat(after).isEqualTo(before + 1);
    }

    @Test
    @WithMockUser(roles = "OFFICER")
    void missingChannelIsBadRequest() throws Exception {
        mockMvc.perform(post("/api/debtors/{debtorKey}/engagements", DEBTOR_KEY)
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "MANAGER")
    void unknownChannelIsBadRequest() throws Exception {
        mockMvc.perform(post("/api/debtors/{debtorKey}/engagements", DEBTOR_KEY)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new com.adaptit.studentdebt.dto.EngagementRequestDto("FAX", null))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "OFFICER")
    void unknownDebtorIsNotFound() throws Exception {
        mockMvc.perform(post("/api/debtors/{debtorKey}/engagements", "NOT-A-DEBTOR")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new com.adaptit.studentdebt.dto.EngagementRequestDto("SMS", null))))
                .andExpect(status().isNotFound());
    }

    @Test
    void anOfficerOutsideTheCaseTeamIsForbidden() throws Exception {
        // STU-100301-2026 belongs to Thato's caseload (see PortfolioScopeTest) — an officer on an
        // unrelated team must not be able to log an engagement on it (issue #55's access rule,
        // reused here the same way decide()/detail() already enforce it).
        RequestPostProcessor outsideOfficer = jwt()
                .jwt(j -> j.subject("other.officer").claim("name", "Other Officer").claim("role", "OFFICER")
                        .claim("team", "Team Z").claim("officerKey", "other-officer"))
                .authorities(new SimpleGrantedAuthority("ROLE_OFFICER"));

        mockMvc.perform(post("/api/debtors/{debtorKey}/engagements", DEBTOR_KEY)
                        .with(outsideOfficer)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new com.adaptit.studentdebt.dto.EngagementRequestDto("SMS", null))))
                .andExpect(status().isForbidden());
    }

    @Test
    void unauthenticatedRequestIsRejected() throws Exception {
        mockMvc.perform(post("/api/debtors/{debtorKey}/engagements", DEBTOR_KEY)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(
                                new com.adaptit.studentdebt.dto.EngagementRequestDto("SMS", null))))
                .andExpect(status().isUnauthorized());
    }
}
