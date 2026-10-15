package com.adaptit.studentdebt.config;

import com.adaptit.studentdebt.security.PortfolioEscalationAuditInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Audits full-portfolio views on every endpoint that takes a portfolio scope (issues #55, #62). */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final PortfolioEscalationAuditInterceptor portfolioEscalationAuditInterceptor;

    public WebConfig(PortfolioEscalationAuditInterceptor portfolioEscalationAuditInterceptor) {
        this.portfolioEscalationAuditInterceptor = portfolioEscalationAuditInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(portfolioEscalationAuditInterceptor)
                .addPathPatterns("/api/debtors", "/api/debtors/export", "/api/summary", "/api/ageing");
    }
}
