package com.adaptit.studentdebt.repository;

import com.adaptit.studentdebt.domain.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {

    Optional<AppUser> findByUsernameIgnoreCase(String username);

    List<AppUser> findAllByTeam(String team);

    Optional<AppUser> findByOfficerKey(String officerKey);

    /** Everyone cases can be assigned to (issue #56): enabled users with an officer key. */
    List<AppUser> findAllByOfficerKeyIsNotNullAndEnabledTrueOrderByTeamAscDisplayNameAsc();
}
