package com.adaptit.studentdebt.writeback;

import com.adaptit.studentdebt.domain.ActivityLogEntry;
import org.springframework.stereotype.Component;

/**
 * Stands in for a real push to ITS Integrator (issue #1/#33 — no such endpoint exists yet). Always
 * succeeds, so the retry/attempt-log plumbing is exercised against a predictable adapter; a real
 * implementation replaces this bean wholesale once the ITS Integrator write-back path exists.
 */
@Component
public class MockActivityLogWriteBackAdapter implements ActivityLogWriteBackAdapter {

    @Override
    public WriteBackResult attemptWrite(ActivityLogEntry entry) {
        return WriteBackResult.ok();
    }
}
