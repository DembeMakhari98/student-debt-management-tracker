package com.adaptit.studentdebt.web;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * POST /api/cases/auto-resolve against the real seeded database (issue #58) — role gating and
 * that a second run back-to-back is a no-op (proves the already-decided check end-to-end).
 */
@SpringBootTest
@AutoConfigureMockMvc
class CaseAutoResolveControllerTest {

    private static final String DEMO_PASSWORD = "Debt@2026!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void officerIsForbiddenFromTriggeringAnAutoResolveRun() throws Exception {
        mockMvc.perform(autoResolve(tokenFor("anele.dube")))
                .andExpect(status().isForbidden());
    }

    @Test
    void managerCanTriggerAnAutoResolveRunAndItReturnsAWellFormedResult() throws Exception {
        mockMvc.perform(autoResolve(tokenFor("grace.vanrooyen")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resolvedCount").isNumber())
                .andExpect(jsonPath("$.debtorKeys").isArray());
    }

    @Test
    void adminCanTriggerAnAutoResolveRun() throws Exception {
        mockMvc.perform(autoResolve(tokenFor("admin")))
                .andExpect(status().isOk());
    }

    @Test
    void runningItTwiceInARowResolvesNothingTheSecondTime() throws Exception {
        String token = tokenFor("grace.vanrooyen");
        mockMvc.perform(autoResolve(token)).andExpect(status().isOk());

        mockMvc.perform(autoResolve(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resolvedCount").value(0))
                .andExpect(jsonPath("$.debtorKeys").isEmpty());
    }

    @Test
    void anUnauthenticatedRequestIsRejected() throws Exception {
        mockMvc.perform(post("/api/cases/auto-resolve")).andExpect(status().isUnauthorized());
    }

    private static org.springframework.test.web.servlet.RequestBuilder autoResolve(String token) {
        return post("/api/cases/auto-resolve").header("Authorization", "Bearer " + token);
    }

    private String tokenFor(String username) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + DEMO_PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode json = objectMapper.readTree(body);
        assertEquals(username, json.get("user").get("username").asString());
        return json.get("token").asString();
    }
}
