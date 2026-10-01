package com.adaptit.studentdebt.writeback;

import com.adaptit.studentdebt.domain.ActivityLogEntry;

/**
 * The one port the write-back service depends on (issue #3, mirroring issue #1's architecture
 * decision for the nightly extract — see TECHNICAL_SPECIFICATION.md §2). A real implementation
 * pushes the entry into the student's ITS Integrator activity log. Until that integration exists
 * (issue #1's spike found no write-back path today; issue #33 deferred building it), {@link
 * MockActivityLogWriteBackAdapter} stands in — swapping the two is the only change needed anywhere
 * in the codebase.
 */
public interface ActivityLogWriteBackAdapter {

    WriteBackResult attemptWrite(ActivityLogEntry entry);
}
