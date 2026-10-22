package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.domain.Debtor;
import com.adaptit.studentdebt.domain.RecommendationType;
import com.adaptit.studentdebt.domain.ReminderCadenceProgress;
import com.adaptit.studentdebt.dto.PortfolioEscalationDto;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.PortfolioEscalationRepository;
import com.adaptit.studentdebt.repository.ReminderCadenceProgressRepository;
import com.adaptit.studentdebt.repository.SystemSettingRepository;
import com.adaptit.studentdebt.service.DecisionEngineService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.hasItem;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * GET /api/reminders/progress and POST /api/admin/reminders/run against the real seeded database
 * (issue #60): portfolio scoping like #55, the manager-only run, and the #62 audit. Transactional, so
 * the progress rows, settings and audit rows each test writes are rolled back.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ReminderCadenceControllerTest {

    // Seeded owners (see the #55/#56/#62 handover): Team A = Nomsa + Sibusiso, Team B = Anele + Priya,
    // Team C = Thato + Grace.
    private static final String NOMSA_CASE = "STU-100234-2026";
    private static final String SIBUSISO_CASE = "STU-100251-2026";
    private static final String PRIYA_CASE = "STU-100290-2026";
    private static final String THATO_CASE = "STU-100301-2026";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private ReminderCadenceProgressRepository progressRepository;
    @Autowired
    private DebtorRepository debtorRepository;
    @Autowired
    private SystemSettingRepository systemSettingRepository;
    @Autowired
    private PortfolioEscalationRepository escalationRepository;
    @Autowired
    private DecisionEngineService decisionEngineService;

    private static RequestPostProcessor nomsa() {
        return jwt().jwt(j -> j.subject("nomsa.mahlangu").claim("name", "Nomsa Mahlangu").claim("role", "OFFICER")
                        .claim("team", "Team A").claim("officerKey", "nomsa-mahlangu"))
                .authorities(new SimpleGrantedAuthority("ROLE_OFFICER"));
    }

    private static RequestPostProcessor grace() {
        return jwt().jwt(j -> j.subject("grace.vanrooyen").claim("name", "Grace van Rooyen").claim("role", "MANAGER")
                        .claim("team", "Team C").claim("officerKey", "grace-van-rooyen"))
                .authorities(new SimpleGrantedAuthority("ROLE_MANAGER"));
    }

    private static RequestPostProcessor admin() {
        return jwt().jwt(j -> j.subject("admin").claim("name", "System Administrator").claim("role", "ADMIN"))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private void start(String debtorKey, Instant startedAt) {
        ReminderCadenceProgress p = new ReminderCadenceProgress();
        p.setDebtorKey(debtorKey);
        p.setStartedAt(startedAt);
        progressRepository.saveAndFlush(p);
    }

    @BeforeEach
    void seedProgress() {
        Instant now = Instant.now();
        start(NOMSA_CASE, now.minus(3, ChronoUnit.DAYS));
        start(SIBUSISO_CASE, now.minus(2, ChronoUnit.DAYS));
        start(PRIYA_CASE, now.minus(1, ChronoUnit.DAYS));
        start(THATO_CASE, now);
    }

    // ---- GET /api/reminders/progress: scoping ----

    @Test
    void anOfficerSeesOnlyTheirOwnCasesByDefault() throws Exception {
        mockMvc.perform(get("/api/reminders/progress").with(nomsa()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].debtorKey", contains(NOMSA_CASE)));
    }

    @Test
    void anOfficerCanAskForTheirTeam() throws Exception {
        mockMvc.perform(get("/api/reminders/progress").param("portfolio", "team").with(nomsa()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].debtorKey", containsInAnyOrder(NOMSA_CASE, SIBUSISO_CASE)))
                .andExpect(jsonPath("$[*].debtorKey", not(hasItem(THATO_CASE))));
    }

    @Test
    void anOfficerAskingForTheFullPortfolioIsRefused() throws Exception {
        mockMvc.perform(get("/api/reminders/progress").param("portfolio", "all").with(nomsa()))
                .andExpect(status().isForbidden());
    }

    @Test
    void anUnknownPortfolioValueIsABadRequest() throws Exception {
        mockMvc.perform(get("/api/reminders/progress").param("portfolio", "everyone").with(nomsa()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aManagerSeesEveryCaseWithTheFullPortfolio() throws Exception {
        mockMvc.perform(get("/api/reminders/progress").param("portfolio", "all").with(grace()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].debtorKey", hasItems(NOMSA_CASE, SIBUSISO_CASE, PRIYA_CASE, THATO_CASE)));
    }

    @Test
    void anAdminSeesEveryCaseWithTheFullPortfolio() throws Exception {
        mockMvc.perform(get("/api/reminders/progress").param("portfolio", "all").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].debtorKey", hasItems(NOMSA_CASE, SIBUSISO_CASE, PRIYA_CASE, THATO_CASE)));
    }

    @Test
    void aManagersOwnViewDoesNotIncludeOtherOfficersCases() throws Exception {
        mockMvc.perform(get("/api/reminders/progress").with(grace()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].debtorKey", not(hasItem(NOMSA_CASE))))
                .andExpect(jsonPath("$[*].debtorKey", not(hasItem(SIBUSISO_CASE))))
                .andExpect(jsonPath("$[*].debtorKey", not(hasItem(PRIYA_CASE))))
                .andExpect(jsonPath("$[*].debtorKey", not(hasItem(THATO_CASE))));
    }

    @Test
    void scopeComesFromTheTokenNotFromRequestParameters() throws Exception {
        mockMvc.perform(get("/api/reminders/progress").param("officerKey", "thato-mokoena").param("team", "Team C")
                        .with(nomsa()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].debtorKey", contains(NOMSA_CASE)));
    }

    @Test
    void anUnauthenticatedReadIsRejected() throws Exception {
        mockMvc.perform(get("/api/reminders/progress")).andExpect(status().isUnauthorized());
    }

    @Test
    void aRowShowsTheStudentTheOwnerAndTheNextStep() throws Exception {
        mockMvc.perform(get("/api/reminders/progress").with(nomsa()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].studentName").isNotEmpty())
                .andExpect(jsonPath("$[0].assignedOfficer").value("nomsa-mahlangu"))
                .andExpect(jsonPath("$[0].startedAt").isNotEmpty())
                .andExpect(jsonPath("$[0].stepsSent").value(0))
                .andExpect(jsonPath("$[0].nextStep").value(1))
                .andExpect(jsonPath("$[0].nextStepDueAt").isNotEmpty());
    }

    @Test
    void theOldestCadenceIsListedFirst() throws Exception {
        mockMvc.perform(get("/api/reminders/progress").param("portfolio", "team").with(nomsa()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].debtorKey").value(NOMSA_CASE))
                .andExpect(jsonPath("$[1].debtorKey").value(SIBUSISO_CASE));
    }

    // ---- GET: the #62 audit of full-portfolio views ----

    @Test
    void aFullPortfolioViewIsRecordedInTheAuditTrail() throws Exception {
        long before = escalationRepository.count();

        mockMvc.perform(get("/api/reminders/progress").param("portfolio", "all").with(grace()))
                .andExpect(status().isOk());

        assertEquals(before + 1, escalationRepository.count());
        String json = mockMvc.perform(get("/api/audit/portfolio-escalations").param("limit", "1").with(grace()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        PortfolioEscalationDto latest = objectMapper.readValue(json, PortfolioEscalationDto[].class)[0];
        assertEquals("/api/reminders/progress", latest.endpoint());
        assertEquals("grace.vanrooyen", latest.username());
    }

    @Test
    void ownTeamAndRefusedViewsAreNotRecorded() throws Exception {
        long before = escalationRepository.count();

        mockMvc.perform(get("/api/reminders/progress").with(grace())).andExpect(status().isOk());
        mockMvc.perform(get("/api/reminders/progress").param("portfolio", "team").with(grace())).andExpect(status().isOk());
        mockMvc.perform(get("/api/reminders/progress").param("portfolio", "all").with(nomsa())).andExpect(status().isForbidden());

        assertEquals(before, escalationRepository.count());
    }

    // ---- POST /api/admin/reminders/run ----

    @Test
    void anOfficerIsForbiddenFromRunningTheCadence() throws Exception {
        mockMvc.perform(post("/api/admin/reminders/run").with(nomsa())).andExpect(status().isForbidden());
    }

    @Test
    void anUnauthenticatedRunIsRejected() throws Exception {
        mockMvc.perform(post("/api/admin/reminders/run")).andExpect(status().isUnauthorized());
    }

    @Test
    void aManagerCanRunItAndGetsAWellFormedResult() throws Exception {
        mockMvc.perform(post("/api/admin/reminders/run").with(grace()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ranAt").isNotEmpty())
                .andExpect(jsonPath("$.autonomyLevel").isNumber())
                .andExpect(jsonPath("$.dispatchedCount").isNumber())
                .andExpect(jsonPath("$.withheldCount").isNumber())
                .andExpect(jsonPath("$.cancelledCount").isNumber())
                .andExpect(jsonPath("$.dispatched").isArray());
    }

    @Test
    void anAdminCanRunIt() throws Exception {
        mockMvc.perform(post("/api/admin/reminders/run").with(admin())).andExpect(status().isOk());
    }

    @Test
    void atTheDefaultLevel2NothingIsDispatched() throws Exception {
        mockMvc.perform(post("/api/admin/reminders/run").with(grace()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.autonomyLevel").value(2))
                .andExpect(jsonPath("$.dispatchedCount").value(0))
                .andExpect(jsonPath("$.dispatched").isEmpty());
    }

    @Test
    void aRunDispatchesEachDueStepOnceAndASecondRunDispatchesNothingNew() throws Exception {
        Debtor due = debtorRepository.findAll().stream()
                .filter(d -> RecommendationType.REMINDER_CADENCE.name().equals(decisionEngineService.recommend(d).type()))
                .findFirst().orElse(null);
        assumeTrue(due != null, "the seed data has no debtor the engine recommends a reminder cadence for");

        systemSettingRepository.findById("autonomy_level").orElseThrow().setSettingValue("4");
        systemSettingRepository.flush();
        ReminderCadenceProgress existing = progressRepository.findById(due.getDebtorKey()).orElseGet(ReminderCadenceProgress::new);
        existing.setDebtorKey(due.getDebtorKey());
        existing.setStartedAt(Instant.now().minus(20, ChronoUnit.DAYS));
        existing.setStep1SentAt(null);
        existing.setStep2SentAt(null);
        existing.setStep3SentAt(null);
        progressRepository.saveAndFlush(existing);

        mockMvc.perform(post("/api/admin/reminders/run").with(grace()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.autonomyLevel").value(4))
                .andExpect(jsonPath("$.dispatched[?(@.debtorKey=='" + due.getDebtorKey() + "')].step",
                        containsInAnyOrder(1, 2, 3)));

        mockMvc.perform(post("/api/admin/reminders/run").with(grace()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dispatched[?(@.debtorKey=='" + due.getDebtorKey() + "')]").isEmpty());
    }
}
