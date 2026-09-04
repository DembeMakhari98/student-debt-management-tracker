package com.adaptit.studentdebt.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Registered head-count per financial year, sourced from Student Records (business case §3.8). */
@Entity
@Table(name = "registered_count")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RegisteredCount {

    @Id
    @Column(name = "financial_year")
    private Integer financialYear;

    @Column(nullable = false)
    private Integer headcount;
}
