package com.adaptit.studentdebt.security;

import com.adaptit.studentdebt.domain.AppUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/** Issues the signed (HS256) access token returned by POST /api/auth/login. */
@Service
public class JwtService {

    static final String ISSUER = "student-debt-tracker";

    private final JwtEncoder jwtEncoder;
    private final Clock clock;
    private final Duration ttl;

    public JwtService(JwtEncoder jwtEncoder, Clock clock, @Value("${app.security.jwt.ttl:8h}") Duration ttl) {
        this.jwtEncoder = jwtEncoder;
        this.clock = clock;
        this.ttl = ttl;
    }

    public IssuedToken issue(AppUser user) {
        Instant now = clock.instant();
        Instant expiresAt = now.plus(ttl);
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .subject(user.getUsername())
                .issuedAt(now)
                .expiresAt(expiresAt)
                .claim("name", user.getDisplayName())
                .claim("role", user.getRole().name());
        if (user.getTeam() != null) {
            claims.claim("team", user.getTeam());
        }
        if (user.getOfficerKey() != null) {
            claims.claim("officerKey", user.getOfficerKey());
        }
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims.build())).getTokenValue();
        return new IssuedToken(token, expiresAt);
    }

    public record IssuedToken(String token, Instant expiresAt) {
    }
}
