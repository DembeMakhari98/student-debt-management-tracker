package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import com.adaptit.studentdebt.domain.WriteBackAttempt;
import com.adaptit.studentdebt.domain.WriteBackStatus;
import com.adaptit.studentdebt.repository.ActivityLogEntryRepository;
import com.adaptit.studentdebt.repository.WriteBackAttemptRepository;
import com.adaptit.studentdebt.writeback.ActivityLogWriteBackAdapter;
import com.adaptit.studentdebt.writeback.WriteBackResult;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP-level tests for POST /api/admin/writeback/{attemptId}/retry (issue #61). */
@SpringBootTest
@AutoConfigureMockMvc
class WriteBackRetryEndpointTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ActivityLogEntryRepository activityLogEntryRepository;
    @Autowired
    private WriteBackAttemptRepository writeBackAttemptRepository;

    @MockitoBean
    private ActivityLogWriteBackAdapter adapter;

    private ActivityLogEntry savedEntry() {
        return activityLogEntryRepository.save(ActivityLogEntry.builder()
                .debtorKey("STU-100234-2026")
                .text("Recommendation approved by Nomsa Mahlangu")
                .source("Officer decision · Nomsa Mahlangu")
                .createdAt(Instant.now())
                .build());
    }

    private WriteBackAttempt savedAttempt(UUID entryId, int attemptNumber, WriteBackStatus status) {
        return writeBackAttemptRepository.save(WriteBackAttempt.builder()
                .activityLogEntryId(entryId)
                .attemptNumber(attemptNumber)
                .status(status)
                .attemptedAt(Instant.now())
                .build());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanRetryAFailedAttemptImmediately() throws Exception {
        ActivityLogEntry entry = savedEntry();
        WriteBackAttempt failed = savedAttempt(entry.getId(), 1, WriteBackStatus.FAILED);
        when(adapter.attemptWrite(any())).thenReturn(WriteBackResult.ok());

        mockMvc.perform(post("/api/admin/writeback/{id}/retry", failed.getId()))
                .andExpect(status().isOk());

        var attempts = writeBackAttemptRepository.findAllByActivityLogEntryIdOrderByAttemptNumberDesc(entry.getId());
        assertThat(attempts).hasSize(2);
        assertThat(attempts.get(0).getAttemptNumber()).isEqualTo(2);
        assertThat(attempts.get(0).getStatus()).isEqualTo(WriteBackStatus.SUCCESS);
    }

    @Test
    @WithMockUser(roles = "MANAGER")
    void managerCanAlsoRetry() throws Exception {
        ActivityLogEntry entry = savedEntry();
        WriteBackAttempt failed = savedAttempt(entry.getId(), 1, WriteBackStatus.FAILED);
        when(adapter.attemptWrite(any())).thenReturn(WriteBackResult.failed("still down"));

        mockMvc.perform(post("/api/admin/writeback/{id}/retry", failed.getId()))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "OFFICER")
    void officerIsForbidden() throws Exception {
        mockMvc.perform(post("/api/admin/writeback/{id}/retry", UUID.randomUUID()))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void unknownAttemptIdIsNotFound() throws Exception {
        mockMvc.perform(post("/api/admin/writeback/{id}/retry", UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void anAlreadySucceededEntryIsConflict() throws Exception {
        ActivityLogEntry entry = savedEntry();
        WriteBackAttempt succeeded = savedAttempt(entry.getId(), 1, WriteBackStatus.SUCCESS);

        mockMvc.perform(post("/api/admin/writeback/{id}/retry", succeeded.getId()))
                .andExpect(status().isConflict());
    }
}
