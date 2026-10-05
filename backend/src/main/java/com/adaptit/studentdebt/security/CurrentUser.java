package com.adaptit.studentdebt.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

/** The display name actions are attributed to, taken from the token and never from the request body. */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static String displayName(Authentication authentication) {
        if (authentication.getPrincipal() instanceof Jwt jwt && jwt.getClaimAsString("name") != null) {
            return jwt.getClaimAsString("name");
        }
        return authentication.getName();
    }
}
