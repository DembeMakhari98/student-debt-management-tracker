package com.adaptit.studentdebt.repository;

import com.adaptit.studentdebt.domain.RegisteredCount;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RegisteredCountRepository extends JpaRepository<RegisteredCount, Integer> {
}
