package com.adaptit.studentdebt.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

import java.time.Instant;
import java.util.UUID;

/**
 * One full-portfolio (Level 3) view (issue #62): who opened which endpoint with portfolio=all,
 * with which filters, and when. Immutable once written: no setters, and no update or delete path
 * in the API.
 */
@Entity
@Immutable
@Table(name = "portfolio_escalation")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PortfolioEscalation {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, length = 60)
    private String username;

    @Column(name = "display_name", nullable = false, length = 120)
    private String displayName;

    @Column(nullable = false, length = 20)
    private String role;

    @Column(nullable = false, length = 80)
    private String endpoint;

    @Column(name = "year_filter", length = 10)
    private String yearFilter;

    @Column(name = "funding_filter", length = 20)
    private String fundingFilter;

    @Column(name = "list_scope", length = 20)
    private String listScope;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
