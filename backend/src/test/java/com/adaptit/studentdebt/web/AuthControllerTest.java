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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * JWT login against the users seeded by 008-app-user.xml, and the access rules every
 * other /api endpoint now sits behind.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerTest {

    private static final String DEMO_PASSWORD = "Debt@2026!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void seededUserCanLogInAndReceivesTokenWithProfile() throws Exception {
        mockMvc.perform(login("grace.vanrooyen", DEMO_PASSWORD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.expiresAt").isNotEmpty())
                .andExpect(jsonPath("$.user.displayName").value("Grace van Rooyen"))
                .andExpect(jsonPath("$.user.role").value("MANAGER"))
                .andExpect(jsonPath("$.user.team").value("Team C"))
                .andExpect(jsonPath("$.user.officerKey").value("grace-van-rooyen"));
    }

    @Test
    void usernameIsCaseInsensitive() throws Exception {
        mockMvc.perform(login("Nomsa.Mahlangu", DEMO_PASSWORD)).andExpect(status().isOk());
    }

    @Test
    void wrongPasswordAndUnknownUserGetTheSameGeneric401() throws Exception {
        mockMvc.perform(login("nomsa.mahlangu", "wrong-password"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Incorrect username or password"));
        mockMvc.perform(login("nobody", DEMO_PASSWORD))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Incorrect username or password"));
    }

    @Test
    void blankCredentialsAreRejected() throws Exception {
        mockMvc.perform(login("", "")).andExpect(status().isBadRequest());
    }

    @Test
    void apiRequiresAToken() throws Exception {
        mockMvc.perform(get("/api/debtors")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/debtors").header("Authorization", "Bearer not-a-real-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenGrantsAccessAndIdentifiesTheUser() throws Exception {
        String token = tokenFor("nomsa.mahlangu");

        mockMvc.perform(get("/api/debtors").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("nomsa.mahlangu"))
                .andExpect(jsonPath("$.role").value("OFFICER"));
    }

    @Test
    void adminEndpointsAreForbiddenToOfficersButOpenToAdminsAndManagers() throws Exception {
        mockMvc.perform(get("/api/admin/extract/history").header("Authorization", "Bearer " + tokenFor("anele.dube")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/extract/history").header("Authorization", "Bearer " + tokenFor("admin")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/extract/history").header("Authorization", "Bearer " + tokenFor("grace.vanrooyen")))
                .andExpect(status().isOk());
    }

    @Test
    void healthStaysPublic() throws Exception {
        mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    private String tokenFor(String username) throws Exception {
        String body = mockMvc.perform(login(username, DEMO_PASSWORD))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode json = objectMapper.readTree(body);
        assertEquals(username, json.get("user").get("username").asString());
        return json.get("token").asString();
    }

    private static org.springframework.test.web.servlet.RequestBuilder login(String username, String password) {
        return post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}");
    }
}
