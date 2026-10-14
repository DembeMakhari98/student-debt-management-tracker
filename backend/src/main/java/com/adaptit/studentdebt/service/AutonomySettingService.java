package com.adaptit.studentdebt.service;

import com.adaptit.studentdebt.domain.AutonomyLevelAudit;
import com.adaptit.studentdebt.domain.SystemSetting;
import com.adaptit.studentdebt.repository.AutonomyLevelAuditRepository;
import com.adaptit.studentdebt.repository.SystemSettingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Persists a change to the configured agent autonomy level (issue #57) and records who made
 * it, replacing the previously read-only {@code system_setting.autonomy_level} row. Who may
 * call this is enforced by {@code SecurityConfig}'s path rule, not here — by the time this
 * service runs, the caller is already known to be a MANAGER or ADMIN.
 */
@Service
public class AutonomySettingService {

    private static final String SETTING_KEY = "autonomy_level";
    private static final int DEFAULT_LEVEL = 2;

    private final SystemSettingRepository systemSettingRepository;
    private final AutonomyLevelAuditRepository autonomyLevelAuditRepository;

    public AutonomySettingService(SystemSettingRepository systemSettingRepository,
                                   AutonomyLevelAuditRepository autonomyLevelAuditRepository) {
        this.systemSettingRepository = systemSettingRepository;
        this.autonomyLevelAuditRepository = autonomyLevelAuditRepository;
    }

    @Transactional
    public int update(int newLevel, String changedBy) {
        SystemSetting setting = systemSettingRepository.findById(SETTING_KEY)
                .orElseGet(() -> new SystemSetting(SETTING_KEY, String.valueOf(DEFAULT_LEVEL)));
        int oldLevel = Integer.parseInt(setting.getSettingValue());

        setting.setSettingValue(String.valueOf(newLevel));
        systemSettingRepository.save(setting);

        autonomyLevelAuditRepository.save(AutonomyLevelAudit.builder()
                .oldLevel(oldLevel)
                .newLevel(newLevel)
                .changedBy(changedBy)
                .changedAt(Instant.now())
                .build());

        return newLevel;
    }
}
