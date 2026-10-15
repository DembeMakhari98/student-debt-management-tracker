package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.AgeingResponseDto;
import com.adaptit.studentdebt.dto.DebtorRowDto;
import com.adaptit.studentdebt.dto.SummaryDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.ObjectMapper;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Portfolio scoping enforced by the API (issue #55), against the Liquibase-seeded demo caseload
 * (010-debtor-assignment.xml) and demo users (008-app-user.xml). Callers carry the same claims
 * JwtService issues at login, so own/team are resolved exactly as in production.
 */
@SpringBootTest
@AutoConfigureMockMvc
class PortfolioScopeTest {

    private static final Set<String> NOMSA = Set.of("STU-100234", "STU-100333", "STU-098077", "STU-095021", "STU-088002");
    private static final Set<String> SIBUSISO = Set.of("STU-100251", "STU-100360", "STU-098090", "STU-095050", "STU-088040");
    private static final Set<String> THATO = Set.of("STU-100301", "STU-098012", "STU-098155", "STU-091033");
    private static final Set<String> GRACE = Set.of("STU-100312", "STU-098044", "STU-095003", "STU-091074");
    private static final int WHOLE_BOOK = 26;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    // ---- callers, with the claims JwtService puts in a real token ----

    private static RequestPostProcessor nomsa() {
        return user("nomsa.mahlangu", "OFFICER", "Team A", "nomsa-mahlangu");
    }

    private static RequestPostProcessor grace() {
        return user("grace.vanrooyen", "MANAGER", "Team C", "grace-van-rooyen");
    }

    private static RequestPostProcessor admin() {
        return user("admin", "ADMIN", null, null);
    }

    private static RequestPostProcessor user(String username, String role, String team, String officerKey) {
        return jwt()
                .jwt(j -> {
                    j.subject(username).claim("name", username).claim("role", role);
                    if (team != null) j.claim("team", team);
                    if (officerKey != null) j.claim("officerKey", officerKey);
                })
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    // ---- own / team / all per role ----

    @Test
    void officerOwnCoversOnlyTheirCaseload() throws Exception {
        assertEquals(NOMSA, exportedStudents(nomsa(), "own"));
    }

    @Test
    void portfolioDefaultsToOwn() throws Exception {
        assertEquals(NOMSA, exportedStudents(nomsa(), null));
    }

    @Test
    void officerTeamCoversEveryOfficerInTheirTeam() throws Exception {
        assertEquals(union(NOMSA, SIBUSISO), exportedStudents(nomsa(), "team"));
    }

    @Test
    void officerCannotOpenTheFullPortfolioOnAnyEndpoint() throws Exception {
        for (String path : new String[]{"/api/debtors", "/api/summary", "/api/ageing", "/api/debtors/export"}) {
            mockMvc.perform(get(path).param("portfolio", "all").with(nomsa()))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void managerSeesOwnTeamAndWholeBook() throws Exception {
        assertEquals(GRACE, exportedStudents(grace(), "own"));
        assertEquals(union(THATO, GRACE), exportedStudents(grace(), "team"));
        assertEquals(WHOLE_BOOK, exportedStudents(grace(), "all").size());
    }

    @Test
    void adminHasNoCaseloadButSeesWholeBook() throws Exception {
        assertEquals(Set.of(), exportedStudents(admin(), "own"));
        assertEquals(Set.of(), exportedStudents(admin(), "team"));
        assertEquals(WHOLE_BOOK, exportedStudents(admin(), "all").size());
    }

    @Test
    void scopeComesFromTheTokenNotFromRequestParameters() throws Exception {
        String csv = mockMvc.perform(get("/api/debtors/export").param("year", "all")
                        .param("officerKey", "thato-mokoena").param("team", "Team C").with(nomsa()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertEquals(NOMSA, studentIds(csv));
    }

    @Test
    void unknownPortfolioValueIsRejected() throws Exception {
        mockMvc.perform(get("/api/debtors").param("portfolio", "everyone").with(nomsa()))
                .andExpect(status().isBadRequest());
    }

    // ---- every scoped endpoint honours the same scope ----

    @Test
    void worklistRowsCarryTheirAssignedOfficerAndStayInScope() throws Exception {
        DebtorRowDto[] rows = read(get("/api/debtors").param("scope", "cases").param("year", "all")
                .param("portfolio", "team").with(nomsa()), DebtorRowDto[].class);
        assertTrue(rows.length > 0);
        for (DebtorRowDto r : rows) {
            assertTrue(Set.of("nomsa-mahlangu", "sibusiso-khoza").contains(r.assignedOfficer()),
                    r.debtorKey() + " is assigned to " + r.assignedOfficer());
        }
    }

    @Test
    void summaryCoversOnlyThePortfolio() throws Exception {
        SummaryDto own = read(get("/api/summary").param("year", "all").with(nomsa()), SummaryDto.class);
        SummaryDto all = read(get("/api/summary").param("year", "all").param("portfolio", "all").with(grace()), SummaryDto.class);
        assertTrue(own.debtorCount() <= NOMSA.size(), "own debtor count " + own.debtorCount());
        assertTrue(own.totalDebt().compareTo(all.totalDebt()) < 0);
        // The registered headcount is institution-wide, not per caseload.
        assertEquals(all.registeredStudents(), own.registeredStudents());
    }

    @Test
    void ageingCoversOnlyThePortfolio() throws Exception {
        AgeingResponseDto ageing = read(get("/api/ageing").param("year", "all").with(nomsa()), AgeingResponseDto.class);
        assertTrue(!ageing.students().isEmpty());
        ageing.students().forEach(s -> assertTrue(NOMSA.contains(s.studentId()), s.studentId() + " is not Nomsa's"));
    }

    // ---- opening and deciding a single case ----

    @Test
    void officerCanOpenATeamMatesCaseButNotAnotherTeams() throws Exception {
        mockMvc.perform(get("/api/debtors/{key}", "STU-100251-2026").with(nomsa())).andExpect(status().isOk());
        mockMvc.perform(get("/api/debtors/{key}", "STU-100301-2026").with(nomsa())).andExpect(status().isForbidden());
    }

    @Test
    void managerCanOpenAnyCase() throws Exception {
        mockMvc.perform(get("/api/debtors/{key}", "STU-100234-2026").with(grace())).andExpect(status().isOk());
    }

    @Test
    void unknownCaseIsStillNotFound() throws Exception {
        mockMvc.perform(get("/api/debtors/{key}", "STU-000000-2026").with(nomsa())).andExpect(status().isNotFound());
    }

    @Test
    void officerCannotDecideACaseOutsideTheirTeam() throws Exception {
        mockMvc.perform(post("/api/debtors/{key}/decision", "STU-100301-2026").with(nomsa())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"action\":\"APPROVE\"}"))
                .andExpect(status().isForbidden());
    }

    // ---- helpers ----

    /** Student ids in the CSV export across all years — the export includes every row in scope. */
    private Set<String> exportedStudents(RequestPostProcessor caller, String portfolio) throws Exception {
        MockHttpServletRequestBuilder req = get("/api/debtors/export").param("year", "all").with(caller);
        if (portfolio != null) req.param("portfolio", portfolio);
        return studentIds(mockMvc.perform(req).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private static Set<String> studentIds(String csv) {
        return Arrays.stream(csv.split("\n")).skip(1).filter(l -> !l.isBlank())
                .map(l -> l.substring(0, l.indexOf(',')))
                .collect(Collectors.toSet());
    }

    private <T> T read(MockHttpServletRequestBuilder req, Class<T> type) throws Exception {
        return objectMapper.readValue(mockMvc.perform(req).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(), type);
    }

    @SafeVarargs
    private static Set<String> union(Set<String>... sets) {
        return Arrays.stream(sets).flatMap(Set::stream).collect(Collectors.toSet());
    }
}
