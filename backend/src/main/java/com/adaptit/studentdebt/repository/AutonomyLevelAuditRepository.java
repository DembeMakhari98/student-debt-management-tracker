package com.adaptit.studentdebt.repository;

import com.adaptit.studentdebt.domain.AutonomyLevelAudit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AutonomyLevelAuditRepository extends JpaRepository<AutonomyLevelAudit, UUID> {
}
