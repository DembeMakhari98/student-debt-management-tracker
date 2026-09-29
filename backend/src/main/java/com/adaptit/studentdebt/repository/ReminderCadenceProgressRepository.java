package com.adaptit.studentdebt.repository;

import com.adaptit.studentdebt.domain.ReminderCadenceProgress;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReminderCadenceProgressRepository extends JpaRepository<ReminderCadenceProgress, String> {
}
