package com.adaptit.studentdebt.repository;

import com.adaptit.studentdebt.domain.SystemSetting;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SystemSettingRepository extends JpaRepository<SystemSetting, String> {
}
