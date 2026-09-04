package com.adaptit.studentdebt.repository;

import com.adaptit.studentdebt.domain.OfficerDecision;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OfficerDecisionRepository extends JpaRepository<OfficerDecision, java.util.UUID> {

    List<OfficerDecision> findAllByDebtorKeyOrderByDecidedAtDesc(String debtorKey);

    Optional<OfficerDecision> findFirstByDebtorKeyAndRecommendationTypeOrderByDecidedAtDesc(
            String debtorKey, String recommendationType);
}
