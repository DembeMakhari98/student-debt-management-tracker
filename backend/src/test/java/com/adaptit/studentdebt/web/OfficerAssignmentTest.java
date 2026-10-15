package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.dto.CaseDetailDto;
import com.adaptit.studentdebt.dto.OfficerDto;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.WriteBackAttemptRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.ObjectMapper;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Officer roster and case reassignment (issue #56), against the seeded demo users and caseload. */
@SpringBootTest
@AutoConfigureMockMvc
class OfficerAssignmentTest {

    /** Priya Naidoo's case in the seed data (010-debtor-assignment.xml). */
    private static final String CASE = "STU-100290-2026";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DebtorRepository debtorRepository;

    @Autowired
    private ActivityLogEntryRepository activityLogEntryRepository;

    @Autowired
    private WriteBackAttemptRepository writeBackAttemptRepository;

    private static RequestPostProcessor as(String name, String role) {
        return jwt().jwt(j -> j.subject(name).claim("name", name).claim("role", role))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    private ResultActions reassign(String debtorKey, String body, RequestPostProcessor caller) throws Exception {
        return mockMvc.perform(patch("/api/debtors/{key}/assignment", debtorKey).with(caller)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void rosterListsEveryAssignableOfficerWithTeamAndRole() throws Exception {
        String json = mockMvc.perform(get("/api/officers").with(as("Nomsa Mahlangu", "OFFICER")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        Map<String, OfficerDto> byId = Arrays.stream(objectMapper.readValue(json, OfficerDto[].class))
                .collect(Collectors.toMap(OfficerDto::id, o -> o));

        // Six officers with a caseload; the administrator has no officer key, so isn't assignable.
        assertEquals(6, byId.size());
        assertEquals(new OfficerDto("grace-van-rooyen", "Grace van Rooyen", "Team C", "MANAGER"), byId.get("grace-van-rooyen"));
        assertEquals("Team B", byId.get("priya-naidoo").team());
        assertEquals("OFFICER", byId.get("priya-naidoo").role());
    }

    @Test
    void officerCannotReassign() throws Exception {
        reassign(CASE, "{\"officerKey\":\"thato-mokoena\"}", as("Nomsa Mahlangu", "OFFICER"))
                .andExpect(status().isForbidden());
        assertEquals("priya-naidoo", debtorRepository.findById(CASE).orElseThrow().getAssignedOfficer());
    }

    @Test
    void unknownOfficerIsBadRequest() throws Exception {
        reassign(CASE, "{\"officerKey\":\"nobody\"}", as("Grace van Rooyen", "MANAGER"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void blankOfficerIsBadRequest() throws Exception {
        reassign(CASE, "{\"officerKey\":\" \"}", as("Grace van Rooyen", "MANAGER"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unknownCaseIsNotFound() throws Exception {
        reassign("STU-000000-2026", "{\"officerKey\":\"thato-mokoena\"}", as("Grace van Rooyen", "MANAGER"))
                .andExpect(status().isNotFound());
    }

    @Test
    void managerReassignsCaseAndItIsLoggedAndWrittenBack() throws Exception {
        try {
            String json = reassign(CASE, "{\"officerKey\":\"thato-mokoena\"}", as("Grace van Rooyen", "MANAGER"))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            CaseDetailDto detail = objectMapper.readValue(json, CaseDetailDto.class);

            assertEquals("thato-mokoena", detail.debtor().assignedOfficer());
            assertEquals("thato-mokoena", debtorRepository.findById(CASE).orElseThrow().getAssignedOfficer());

            String expected = "Case reassigned from Priya Naidoo to Thato Mokoena (Team C) by Grace van Rooyen";
            assertTrue(detail.activity().stream().anyMatch(a -> a.text().equals(expected)), "activity: " + detail.activity());

            ActivityLogEntry entry = latestEntry();
            assertEquals(expected, entry.getText());
            assertEquals("Case assignment · Grace van Rooyen", entry.getSource());
            assertFalse(writeBackAttemptRepository.findAllByActivityLogEntryIdOrderByAttemptNumberDesc(entry.getId()).isEmpty(),
                    "reassignment must go through the ITS Integrator write-back");
        } finally {
            restore();
        }
    }

    @Test
    void reassigningToTheCurrentOfficerChangesNothing() throws Exception {
        int before = activityLogEntryRepository.findAllByDebtorKeyOrderByCreatedAtDesc(CASE).size();
        reassign(CASE, "{\"officerKey\":\"priya-naidoo\"}", as("Admin", "ADMIN")).andExpect(status().isOk());
        assertEquals(before, activityLogEntryRepository.findAllByDebtorKeyOrderByCreatedAtDesc(CASE).size());
    }

    private ActivityLogEntry latestEntry() {
        List<ActivityLogEntry> entries = activityLogEntryRepository.findAllByDebtorKeyOrderByCreatedAtDesc(CASE);
        assertFalse(entries.isEmpty());
        return entries.get(0);
    }

    /** Puts the seeded assignment back so other tests sharing the in-memory database see the seed caseload. */
    private void restore() {
        Debtor d = debtorRepository.findById(CASE).orElseThrow();
        d.setAssignedOfficer("priya-naidoo");
        debtorRepository.save(d);
    }
}
