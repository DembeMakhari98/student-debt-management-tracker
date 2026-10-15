package com.adaptit.studentdebt.dto;

import com.adaptit.studentdebt.domain.AppUser;

/** Someone a case can be assigned to (issue #56). {@code id} is the officer key debtors are assigned by. */
public record OfficerDto(String id, String name, String team, String role) {

    public static OfficerDto from(AppUser user) {
        return new OfficerDto(user.getOfficerKey(), user.getDisplayName(), user.getTeam(), user.getRole().name());
    }
}
