package com.adaptit.studentdebt.repository;

import com.adaptit.studentdebt.domain.WriteBackAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WriteBackAttemptRepository extends JpaRepository<WriteBackAttempt, UUID> {

    List<WriteBackAttempt> findAllByActivityLogEntryIdOrderByAttemptNumberDesc(UUID activityLogEntryId);
}
