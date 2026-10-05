package com.adaptit.studentdebt.dto;

import com.adaptit.studentdebt.domain.AppUser;

/** The signed-in user as the frontend sees them. */
public record AuthUserDto(String username, String displayName, String role, String team, String officerKey) {

    public static AuthUserDto from(AppUser user) {
        return new AuthUserDto(user.getUsername(), user.getDisplayName(), user.getRole().name(),
                user.getTeam(), user.getOfficerKey());
    }
}
