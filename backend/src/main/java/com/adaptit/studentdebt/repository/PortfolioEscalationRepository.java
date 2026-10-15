package com.adaptit.studentdebt.repository;

import com.adaptit.studentdebt.domain.PortfolioEscalation;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PortfolioEscalationRepository extends JpaRepository<PortfolioEscalation, UUID> {

    List<PortfolioEscalation> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
