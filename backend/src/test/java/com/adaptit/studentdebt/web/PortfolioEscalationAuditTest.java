package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.PortfolioEscalationDto;
import com.adaptit.studentdebt.repository.PortfolioEscalationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Audit trail for full-portfolio (Level 3) views (issue #62). */
@SpringBootTest
@AutoConfigureMockMvc
class PortfolioEscalationAuditTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PortfolioEscalationRepository repository;

    private static RequestPostProcessor grace() {
        return jwt().jwt(j -> j.subject("grace.vanrooyen").claim("name", "Grace van Rooyen").claim("role", "MANAGER")
                        .claim("team", "Team C").claim("officerKey", "grace-van-rooyen"))
                .authorities(new SimpleGrantedAuthority("ROLE_MANAGER"));
    }

    private static RequestPostProcessor nomsa() {
        return jwt().jwt(j -> j.subject("nomsa.mahlangu").claim("name", "Nomsa Mahlangu").claim("role", "OFFICER")
                        .claim("team", "Team A").claim("officerKey", "nomsa-mahlangu"))
                .authorities(new SimpleGrantedAuthority("ROLE_OFFICER"));
    }

    @Test
    void fullPortfolioViewIsRecordedWithWhoWhatAndFilters() throws Exception {
        long before = repository.count();
        mockMvc.perform(get("/api/debtors").param("portfolio", "all").param("year", "2026")
                .param("funding", "gov").param("scope", "cases").with(grace())).andExpect(status().isOk());
        assertEquals(before + 1, repository.count());

        PortfolioEscalationDto latest = latest();
        assertEquals("grace.vanrooyen", latest.username());
        assertEquals("Grace van Rooyen", latest.displayName());
        assertEquals("MANAGER", latest.role());
        assertEquals("/api/debtors", latest.endpoint());
        assertEquals("2026", latest.year());
        assertEquals("gov", latest.funding());
        assertEquals("cases", latest.scope());
        assertNotNull(latest.createdAt());
    }

    @Test
    void everyScopedEndpointIsAudited() throws Exception {
        for (String path : new String[]{"/api/summary", "/api/ageing", "/api/debtors/export", "/api/reminders/progress"}) {
            long before = repository.count();
            mockMvc.perform(get(path).param("portfolio", "all").with(grace())).andExpect(status().isOk());
            assertEquals(before + 1, repository.count(), path + " was not audited");
            assertEquals(path, latest().endpoint());
        }
    }

    @Test
    void ownAndTeamViewsAreNotEscalations() throws Exception {
        long before = repository.count();
        mockMvc.perform(get("/api/debtors").with(grace())).andExpect(status().isOk());
        mockMvc.perform(get("/api/debtors").param("portfolio", "team").with(grace())).andExpect(status().isOk());
        assertEquals(before, repository.count());
    }

    @Test
    void refusedFullPortfolioRequestIsNotRecorded() throws Exception {
        long before = repository.count();
        mockMvc.perform(get("/api/debtors").param("portfolio", "all").with(nomsa())).andExpect(status().isForbidden());
        assertEquals(before, repository.count());
    }

    @Test
    void auditTrailIsManagerAndAdminOnly() throws Exception {
        mockMvc.perform(get("/api/audit/portfolio-escalations").with(nomsa())).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/audit/portfolio-escalations").with(grace())).andExpect(status().isOk());
    }

    @Test
    void auditTrailCannotBeChangedOrDeleted() throws Exception {
        mockMvc.perform(delete("/api/audit/portfolio-escalations").with(grace())).andExpect(status().isMethodNotAllowed());
        mockMvc.perform(put("/api/audit/portfolio-escalations").with(grace())).andExpect(status().isMethodNotAllowed());
    }

    private PortfolioEscalationDto latest() throws Exception {
        String json = mockMvc.perform(get("/api/audit/portfolio-escalations").param("limit", "1").with(grace()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        PortfolioEscalationDto[] rows = objectMapper.readValue(json, PortfolioEscalationDto[].class);
        assertEquals(1, rows.length);
        return rows[0];
    }
}
