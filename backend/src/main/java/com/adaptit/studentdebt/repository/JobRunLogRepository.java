package com.adaptit.studentdebt.repository;

import com.adaptit.studentdebt.domain.JobRunLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface JobRunLogRepository extends JpaRepository<JobRunLog, UUID> {

    List<JobRunLog> findAllByOrderByStartedAtDesc(Pageable pageable);
}
