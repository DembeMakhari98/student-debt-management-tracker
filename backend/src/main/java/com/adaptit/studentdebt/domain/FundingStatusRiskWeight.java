package com.adaptit.studentdebt.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * The funding-status risk-weight lookup table (business case §3.3). Kept as data, not code, so
 * Student Funding can sign off / retune the weighting (risk noted in the business case: "Fairness / bias").
 */
@Entity
@Table(name = "funding_status_risk_weight")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class FundingStatusRiskWeight {

    @Id
    @Column(name = "funding_status", length = 40)
    private String fundingStatus;

    @Column(name = "risk_weight", nullable = false)
    private Integer riskWeight;
}
