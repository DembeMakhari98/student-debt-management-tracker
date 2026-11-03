# Spec: API — manually retry a failed ITS Integrator write-back

**Ticket:** [#61](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/61)
**Branch base:** `develop`
**Blocks:** #69 (@4amogelangkotu) — do this first.

## Overview / Goals

As a system administrator, I want to retry a failed write-back immediately, so that I
don't have to wait for the 15-minute retry job after fixing an integration problem.

## Non-Goals

- No change to the automatic 15-minute sweep (`ActivityLogWriteBackService.retryFailedWriteBacks()`) — this is a separate, on-demand path.
- No `MAX_ATTEMPTS` cap on manual retries — an admin explicitly asking for another try after fixing something should not be blocked by the same 3-attempt ceiling that governs the unattended sweep. This matches "so that I don't have to wait" — the whole point is an override.
- No new security rule — `/api/admin/**` already requires `ADMIN` or `MANAGER` (`SecurityConfig.java:50`).

## User Stories → Acceptance Criteria

- [ ] `POST /api/admin/writeback/{attemptId}/retry` re-attempts that entry and records a new `write_back_attempt`
- [ ] Already-succeeded entry → 409; unknown id → 404
- [ ] MANAGER/ADMIN only (covered by the existing `/api/admin/**` rule)
- [ ] Tests cover success, repeat failure and the 409 case

## Technical Design → Architecture

- `attemptId` identifies a `WriteBackAttempt` row, which carries `activityLogEntryId`. A
  manual retry re-attempts the **entry**, not literally that one row — so the next
  attempt number is always `(current latest attempt for the entry) + 1`, regardless of
  which historical attempt id was passed in. This keeps the `(entry_id, attempt_number)`
  unique constraint from #3 intact no matter which attempt id an admin picks.
- `ActivityLogWriteBackService.retryNow(UUID attemptId)`:
  1. `writeBackAttemptRepository.findById(attemptId)` → `NotFoundException` (404) if absent.
  2. Look up that entry's current latest attempt via the existing
     `findAllByActivityLogEntryIdOrderByAttemptNumberDesc` query (already built for #3,
     previously only exercised by the integration test). If its status is `SUCCESS` →
     `ConflictException` (409).
  3. Otherwise fetch the `ActivityLogEntry` and call the existing `attempt(entry,
     latestAttemptNumber + 1)` — the same adapter-exception-safe, recorder-isolated path
     already used by `recordAndAttempt`/`retryFailedWriteBacks`. `attempt()` changes from
     `void` to returning the saved `WriteBackAttempt` so the controller has something to
     respond with.
- New `web.ConflictException` (`@ResponseStatus(HttpStatus.CONFLICT)`), mirroring the
  existing `NotFoundException` pattern.
- `WriteBackAdminController` gets `POST /{attemptId}/retry`, returning the new
  `WriteBackAttempt` (same convention as `AdminExtractController.run()` returning
  `JobRunLog` directly — no wrapper DTO).

## Testing Strategy

- **Unit (`ActivityLogWriteBackServiceTest`):** unknown attempt id throws
  `NotFoundException`; an entry whose latest attempt already succeeded throws
  `ConflictException`; a failed entry retries immediately regardless of how many prior
  attempts it has (no `MAX_ATTEMPTS` gate), recording the next sequential attempt
  number; the adapter-exception and recorder-isolation guarantees from #3 apply here
  too (reuses `attempt()`).
- **MockMvc (`WriteBackAdminControllerTest` or a new HTTP-level test):** `@WithMockUser(roles = "ADMIN")` succeeds; `@WithMockUser(roles = "OFFICER")` gets 403 (proves the existing security rule actually covers this new path); 404 and 409 cases return the right status codes end-to-end.

## Risks & Mitigations

- **Risk:** retrying an entry that's mid-automatic-retry (sweep + manual retry racing)
  could double-insert. **Mitigation:** same unique constraint from #3 — the loser gets a
  constraint violation, not a silent duplicate (same accepted trade-off as the sweep's
  own concurrency risk, documented in #3's spec).

## Open Questions

None.
