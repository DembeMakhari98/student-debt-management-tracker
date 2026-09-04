package com.adaptit.studentdebt.repository;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ActivityLogEntryRepository extends JpaRepository<ActivityLogEntry, java.util.UUID> {

    List<ActivityLogEntry> findAllByDebtorKeyOrderByCreatedAtDesc(String debtorKey);
}
