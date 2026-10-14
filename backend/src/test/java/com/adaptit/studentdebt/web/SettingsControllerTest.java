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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * PUT /api/settings/autonomy against the users seeded by 008-app-user.xml (issue #57) — role
 * gating, validation and that GET /api/meta reflects a persisted change afterwards.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SettingsControllerTest {

    private static final String DEMO_PASSWORD = "Debt@2026!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void officerIsForbiddenFromChangingTheAutonomyLevel() throws Exception {
        mockMvc.perform(putAutonomy(tokenFor("anele.dube"), 3))
                .andExpect(status().isForbidden());
    }

    @Test
    void managerCanChangeTheAutonomyLevelAndItPersists() throws Exception {
        mockMvc.perform(putAutonomy(tokenFor("grace.vanrooyen"), 3))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.level").value(3));

        mockMvc.perform(get("/api/meta").header("Authorization", "Bearer " + tokenFor("grace.vanrooyen")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.autonomyLevel").value(3));
    }

    @Test
    void adminCanChangeTheAutonomyLevel() throws Exception {
        mockMvc.perform(putAutonomy(tokenFor("admin"), 4))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.level").value(4));
    }

    @Test
    void levelOutsideOneToFourIsRejected() throws Exception {
        mockMvc.perform(putAutonomy(tokenFor("grace.vanrooyen"), 5))
                .andExpect(status().isBadRequest());
        mockMvc.perform(putAutonomy(tokenFor("grace.vanrooyen"), 0))
                .andExpect(status().isBadRequest());
    }

    @Test
    void anUnauthenticatedRequestIsRejected() throws Exception {
        mockMvc.perform(put("/api/settings/autonomy")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"level\":3}"))
                .andExpect(status().isUnauthorized());
    }

    private static org.springframework.test.web.servlet.RequestBuilder putAutonomy(String token, int level) {
        return put("/api/settings/autonomy")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"level\":" + level + "}");
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
