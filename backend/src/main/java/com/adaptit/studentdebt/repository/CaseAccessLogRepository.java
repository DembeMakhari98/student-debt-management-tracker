package com.adaptit.studentdebt.repository;

import com.adaptit.studentdebt.domain.CaseAccessLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CaseAccessLogRepository extends JpaRepository<CaseAccessLog, UUID> {

    List<CaseAccessLog> findAllByDebtorKeyOrderByAccessedAtDesc(String debtorKey);

    List<CaseAccessLog> findAllByDebtorKeyOrderByAccessedAtDesc(String debtorKey, Pageable pageable);

    List<CaseAccessLog> findAllByOrderByAccessedAtDesc(Pageable pageable);

    /** Retention purge only (issue #20). */
    void deleteAllByDebtorKey(String debtorKey);
}
