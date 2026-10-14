package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.AutonomyLevelAudit;
import com.adaptit.studentdebt.domain.SystemSetting;
import com.adaptit.studentdebt.repository.AutonomyLevelAuditRepository;
import com.adaptit.studentdebt.repository.SystemSettingRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Persisting a new autonomy level and auditing the change (issue #57). */
class AutonomySettingServiceTest {

    private final SystemSettingRepository systemSettingRepository = mock(SystemSettingRepository.class);
    private final AutonomyLevelAuditRepository autonomyLevelAuditRepository = mock(AutonomyLevelAuditRepository.class);

    private final AutonomySettingService service =
            new AutonomySettingService(systemSettingRepository, autonomyLevelAuditRepository);

    @Test
    void persistsTheNewLevelAndReturnsIt() {
        when(systemSettingRepository.findById("autonomy_level"))
                .thenReturn(Optional.of(new SystemSetting("autonomy_level", "2")));

        int result = service.update(3, "Grace van Rooyen");

        assertThat(result).isEqualTo(3);
        ArgumentCaptor<SystemSetting> captor = ArgumentCaptor.forClass(SystemSetting.class);
        verify(systemSettingRepository).save(captor.capture());
        assertThat(captor.getValue().getSettingValue()).isEqualTo("3");
    }

    @Test
    void writesAnAuditRowWithTheOldAndNewLevelAndWhoChangedIt() {
        when(systemSettingRepository.findById("autonomy_level"))
                .thenReturn(Optional.of(new SystemSetting("autonomy_level", "2")));

        service.update(4, "Grace van Rooyen");

        ArgumentCaptor<AutonomyLevelAudit> captor = ArgumentCaptor.forClass(AutonomyLevelAudit.class);
        verify(autonomyLevelAuditRepository).save(captor.capture());
        AutonomyLevelAudit audit = captor.getValue();
        assertThat(audit.getOldLevel()).isEqualTo(2);
        assertThat(audit.getNewLevel()).isEqualTo(4);
        assertThat(audit.getChangedBy()).isEqualTo("Grace van Rooyen");
        assertThat(audit.getChangedAt()).isNotNull();
    }

    @Test
    void defaultsTheOldLevelToTwoWhenNoSettingRowExistsYet() {
        when(systemSettingRepository.findById("autonomy_level")).thenReturn(Optional.empty());

        service.update(1, "System Administrator");

        ArgumentCaptor<AutonomyLevelAudit> captor = ArgumentCaptor.forClass(AutonomyLevelAudit.class);
        verify(autonomyLevelAuditRepository).save(captor.capture());
        assertThat(captor.getValue().getOldLevel()).isEqualTo(2);
        assertThat(captor.getValue().getNewLevel()).isEqualTo(1);
        verify(systemSettingRepository).save(any());
    }
}
