package com.adaptit.studentdebt.security;

import com.adaptit.studentdebt.domain.AppUser;
import com.adaptit.studentdebt.domain.PortfolioScope;
import com.adaptit.studentdebt.domain.UserRole;
import com.adaptit.studentdebt.repository.AppUserRepository;
import com.adaptit.studentdebt.service.Portfolio;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;
import java.util.stream.Collectors;

/**
 * Turns the caller's token into the {@link Portfolio} they may see (issue #55). Officer key and team
 * come only from the JWT claims issued at login, so a caller cannot widen their scope by sending
 * someone else's id. OFFICER may request own/team; MANAGER and ADMIN may also request all.
 */
@Component
public class PortfolioResolver {

    private final AppUserRepository appUserRepository;

    public PortfolioResolver(AppUserRepository appUserRepository) {
        this.appUserRepository = appUserRepository;
    }

    /** {@code portfolio} query parameter: own (default) | team | all. */
    public Portfolio resolve(Authentication authentication, String portfolio) {
        return resolve(authentication, parse(portfolio));
    }

    public Portfolio resolve(Authentication authentication, PortfolioScope scope) {
        return switch (scope) {
            case ALL -> {
                if (!canSeeFullPortfolio(authentication)) {
                    throw new AccessDeniedException("The full portfolio is limited to managers and administrators");
                }
                yield Portfolio.ALL;
            }
            case TEAM -> new Portfolio(PortfolioScope.TEAM, teamOfficerKeys(claim(authentication, "team")));
            case OWN -> {
                String officerKey = claim(authentication, "officerKey");
                yield new Portfolio(PortfolioScope.OWN, officerKey == null ? Set.of() : Set.of(officerKey));
            }
        };
    }

    /**
     * The widest scope the caller may open a single case in: an officer may work any case in their
     * team (the frontend's "My team" view), a manager or administrator any case.
     */
    public Portfolio caseAccess(Authentication authentication) {
        return resolve(authentication, canSeeFullPortfolio(authentication) ? PortfolioScope.ALL : PortfolioScope.TEAM);
    }

    static PortfolioScope parse(String portfolio) {
        if (portfolio == null || portfolio.isBlank()) {
            return PortfolioScope.OWN;
        }
        try {
            return PortfolioScope.valueOf(portfolio.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "portfolio must be own, team or all");
        }
    }

    private static boolean canSeeFullPortfolio(Authentication authentication) {
        return authentication.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_" + UserRole.MANAGER.name())
                        || a.getAuthority().equals("ROLE_" + UserRole.ADMIN.name()));
    }

    private Set<String> teamOfficerKeys(String team) {
        if (team == null) {
            return Set.of();
        }
        return appUserRepository.findAllByTeam(team).stream()
                .map(AppUser::getOfficerKey)
                .filter(k -> k != null)
                .collect(Collectors.toSet());
    }

    private static String claim(Authentication authentication, String name) {
        return authentication.getPrincipal() instanceof Jwt jwt ? jwt.getClaimAsString(name) : null;
    }
}
