package com.adaptit.studentdebt.domain;

/**
 * What a signed-in user may do. OFFICER works their own caseload; MANAGER can also take the
 * full-portfolio (Level 3) view and run admin jobs; ADMIN runs admin jobs.
 */
public enum UserRole {
    OFFICER,
    MANAGER,
    ADMIN
}
