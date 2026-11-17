package com.adaptit.studentdebt.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

/** Who the caller is, taken from the token and never from the request body. */
public final class CurrentUser {

    private CurrentUser() {
    }

    /** The display name actions are attributed to. */
    public static String displayName(Authentication authentication) {
        if (authentication.getPrincipal() instanceof Jwt jwt && jwt.getClaimAsString("name") != null) {
            return jwt.getClaimAsString("name");
        }
        return authentication.getName();
    }

    /** OFFICER, MANAGER or ADMIN, from the granted ROLE_ authority. */
    public static String role(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> a.substring("ROLE_".length()))
                .findFirst().orElse("UNKNOWN");
    }

    /** The caller's team, or null when the token has none (e.g. an administrator). */
    public static String team(Authentication authentication) {
        return authentication.getPrincipal() instanceof Jwt jwt ? jwt.getClaimAsString("team") : null;
    }
}
