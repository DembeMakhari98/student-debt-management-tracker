package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.AutonomyLevelResponseDto;
import com.adaptit.studentdebt.dto.AutonomyUpdateRequestDto;
import com.adaptit.studentdebt.security.CurrentUser;
import com.adaptit.studentdebt.service.AutonomySettingService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Writes the system-wide agent autonomy level (issue #57). MANAGER/ADMIN only — enforced by
 * {@code SecurityConfig}'s path rule for this exact endpoint, not here.
 */
@RestController
public class SettingsController {

    private final AutonomySettingService autonomySettingService;

    public SettingsController(AutonomySettingService autonomySettingService) {
        this.autonomySettingService = autonomySettingService;
    }

    @PutMapping("/api/settings/autonomy")
    public AutonomyLevelResponseDto updateAutonomy(@Valid @RequestBody AutonomyUpdateRequestDto request,
                                                    Authentication authentication) {
        int level = autonomySettingService.update(request.level(), CurrentUser.displayName(authentication));
        return new AutonomyLevelResponseDto(level);
    }
}
