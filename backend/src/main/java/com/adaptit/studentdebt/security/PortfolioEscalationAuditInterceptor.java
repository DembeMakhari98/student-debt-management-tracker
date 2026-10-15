package com.adaptit.studentdebt.security;

import com.adaptit.studentdebt.domain.PortfolioEscalation;
import com.adaptit.studentdebt.repository.PortfolioEscalationRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Clock;

/**
 * Records every successful full-portfolio (Level 3) view (issue #62). Registered on the endpoints
 * that take a {@code portfolio} parameter (see WebConfig). A refused request (403, 400) is not a
 * view and isn't recorded, and failing to record never fails the request.
 */
@Component
public class PortfolioEscalationAuditInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(PortfolioEscalationAuditInterceptor.class);

    private final PortfolioEscalationRepository repository;
    private final Clock clock;

    public PortfolioEscalationAuditInterceptor(PortfolioEscalationRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        if (ex != null || response.getStatus() >= 400 || !"all".equalsIgnoreCase(trim(request.getParameter("portfolio")))) {
            return;
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return;
        }
        try {
            repository.save(PortfolioEscalation.builder()
                    .username(authentication.getName())
                    .displayName(CurrentUser.displayName(authentication))
                    .role(role(authentication))
                    .endpoint(request.getRequestURI())
                    .yearFilter(trim(request.getParameter("year")))
                    .fundingFilter(trim(request.getParameter("funding")))
                    .listScope(trim(request.getParameter("scope")))
                    .createdAt(clock.instant())
                    .build());
        } catch (Exception e) {
            log.error("Could not record full-portfolio view by {} on {}", authentication.getName(), request.getRequestURI(), e);
        }
    }

    private static String role(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> a.substring("ROLE_".length()))
                .findFirst().orElse("UNKNOWN");
    }

    private static String trim(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
