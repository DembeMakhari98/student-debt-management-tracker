package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.domain.CaseAccessLog;
import com.adaptit.studentdebt.dto.CaseAccessDto;
import com.adaptit.studentdebt.dto.CaseDetailDto;
import com.adaptit.studentdebt.repository.CaseAccessLogRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Every opening of a student's case is recorded on the server against the signed-in user, with
 * role, team and time (spec §7, POPIA; FTC-38 #127, FTC-93 #196, TC-06 #222, bug #161).
 */
@SpringBootTest
@AutoConfigureMockMvc
class CaseAccessLogTest {

    /** Seeded, in Thato Mokoena's (Team C) caseload; see PortfolioScopeTest. */
    private static final String DEBTOR_KEY = "STU-100301-2026";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private CaseAccessLogRepository repository;

    private static RequestPostProcessor thato() {
        return jwt().jwt(j -> j.subject("thato.mokoena").claim("name", "Thato Mokoena").claim("role", "OFFICER")
                        .claim("team", "Team C").claim("officerKey", "thato-mokoena"))
                .authorities(new SimpleGrantedAuthority("ROLE_OFFICER"));
    }

    private static RequestPostProcessor manager() {
        return jwt().jwt(j -> j.subject("grace.vanrooyen").claim("name", "Grace van Rooyen").claim("role", "MANAGER")
                        .claim("team", "Team C").claim("officerKey", "grace-van-rooyen"))
                .authorities(new SimpleGrantedAuthority("ROLE_MANAGER"));
    }

    private static RequestPostProcessor outsideOfficer() {
        return jwt().jwt(j -> j.subject("other.officer").claim("name", "Other Officer").claim("role", "OFFICER")
                        .claim("team", "Team Z").claim("officerKey", "other-officer"))
                .authorities(new SimpleGrantedAuthority("ROLE_OFFICER"));
    }

    @Test
    void openingACaseStoresWhoOpenedItTheirRoleTeamAndTheTime() throws Exception {
        int before = repository.findAllByDebtorKeyOrderByAccessedAtDesc(DEBTOR_KEY).size();
        Instant start = Instant.now().minus(1, ChronoUnit.SECONDS);

        mockMvc.perform(get("/api/debtors/{debtorKey}", DEBTOR_KEY).with(thato())).andExpect(status().isOk());

        List<CaseAccessLog> rows = repository.findAllByDebtorKeyOrderByAccessedAtDesc(DEBTOR_KEY);
        assertThat(rows).hasSize(before + 1);
        CaseAccessLog latest = rows.get(0);
        assertThat(latest.getUsername()).isEqualTo("thato.mokoena");
        assertThat(latest.getDisplayName()).isEqualTo("Thato Mokoena");
        assertThat(latest.getRole()).isEqualTo("OFFICER");
        assertThat(latest.getTeam()).isEqualTo("Team C");
        assertThat(latest.getAccessedAt()).isAfter(start);
    }

    @Test
    void theCaseActivityShowsTheAccessEntryWithRoleAndTime() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/debtors/{debtorKey}", DEBTOR_KEY).with(thato()))
                .andExpect(status().isOk())
                .andReturn();
        CaseDetailDto detail = objectMapper.readValue(result.getResponse().getContentAsString(), CaseDetailDto.class);

        assertThat(detail.activity()).anySatisfy(a -> {
            assertThat(a.text()).isEqualTo("Case detail viewed by Thato Mokoena");
            assertThat(a.source()).isEqualTo("Access log · Thato Mokoena · Officer · Team C");
            assertThat(a.createdAt()).isNotNull();
        });
    }

    @Test
    void everyOpeningIsRecordedAndEarlierOnesSurvive() throws Exception {
        int before = repository.findAllByDebtorKeyOrderByAccessedAtDesc(DEBTOR_KEY).size();

        mockMvc.perform(get("/api/debtors/{debtorKey}", DEBTOR_KEY).with(thato())).andExpect(status().isOk());
        mockMvc.perform(get("/api/debtors/{debtorKey}", DEBTOR_KEY).with(thato())).andExpect(status().isOk());

        assertThat(repository.findAllByDebtorKeyOrderByAccessedAtDesc(DEBTOR_KEY)).hasSize(before + 2);
    }

    @Test
    void aRefusedOrUnauthenticatedRequestIsNotRecorded() throws Exception {
        int before = repository.findAllByDebtorKeyOrderByAccessedAtDesc(DEBTOR_KEY).size();

        mockMvc.perform(get("/api/debtors/{debtorKey}", DEBTOR_KEY).with(outsideOfficer())).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/debtors/{debtorKey}", DEBTOR_KEY)).andExpect(status().isUnauthorized());

        assertThat(repository.findAllByDebtorKeyOrderByAccessedAtDesc(DEBTOR_KEY)).hasSize(before);
    }

    @Test
    void aManagerCanReadTheAccessTrailForACase() throws Exception {
        mockMvc.perform(get("/api/debtors/{debtorKey}", DEBTOR_KEY).with(thato())).andExpect(status().isOk());

        MvcResult result = mockMvc.perform(get("/api/audit/case-access").param("debtorKey", DEBTOR_KEY).with(manager()))
                .andExpect(status().isOk())
                .andReturn();
        CaseAccessDto[] rows = objectMapper.readValue(result.getResponse().getContentAsString(), CaseAccessDto[].class);

        assertThat(rows).isNotEmpty();
        assertThat(rows).allSatisfy(r -> assertThat(r.debtorKey()).isEqualTo(DEBTOR_KEY));
        assertThat(rows[0].username()).isEqualTo("thato.mokoena");
        assertThat(rows[0].accessedAt()).isNotNull();
    }

    @Test
    void anOfficerCannotReadTheAccessTrail() throws Exception {
        mockMvc.perform(get("/api/audit/case-access").with(thato())).andExpect(status().isForbidden());
    }

    @Test
    void theAccessTrailCannotBeChangedOrDeletedThroughTheApi() throws Exception {
        mockMvc.perform(get("/api/debtors/{debtorKey}", DEBTOR_KEY).with(thato())).andExpect(status().isOk());
        int before = repository.findAllByDebtorKeyOrderByAccessedAtDesc(DEBTOR_KEY).size();

        mockMvc.perform(delete("/api/audit/case-access").with(manager()))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isGreaterThanOrEqualTo(400));
        mockMvc.perform(put("/api/audit/case-access").with(manager()).contentType("application/json").content("[]"))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isGreaterThanOrEqualTo(400));

        assertThat(repository.findAllByDebtorKeyOrderByAccessedAtDesc(DEBTOR_KEY)).hasSize(before);
    }
}
