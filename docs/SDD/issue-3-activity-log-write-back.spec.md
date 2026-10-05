# Spec: Write agent and officer actions back to the ITS Integrator student activity log

**Ticket:** [#3](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/3)
**Branch base:** `develop`
**Spec reference:** TECHNICAL_SPECIFICATION.md §2 (write-back adapter), §7 (auditability)

## Overview / Goals

As a debt officer, I want every agent recommendation and every decision I make to be
written into the student's ITS Integrator record, so that there is a single auditable
history of what happened and why.

**Scope for this pass:** build the write-back port, a mock adapter, and a
retry/attempt-log service, wired into the two places that already persist real
`ActivityLogEntry` rows today — officer decisions (#13, `DecisionService`) and
reminder-cadence dispatch (#9, `ReminderCadenceService`). This satisfies AC2–AC4.
AC1 is explicitly **not** satisfied this pass — see Non-Goals.

## Non-Goals

- **No real ITS Integrator integration.** Issue #1's spike confirmed no write-back
  path exists today, and #33 closed building it as out of scope for this stage with
  no committed timeline. This ticket builds against `MockActivityLogWriteBackAdapter`;
  swapping in a real client later is a contained, single-class change — the same
  pattern already used for the nightly extract (`DebtorSourceAdapter`/
  `MockDebtorSourceAdapter`, issues #1/#2).
- **No persistence of #6's auto-generated scoring signals.** Today
  `CaseAssemblyService.activityOf(Debtor, score, bandLabel)` computes the "risk
  scored," "funding status read," "missed instalments," etc. entries fresh on every
  API call as `ActivityEntryDto`s for display — they are never written to the
  `activity_log_entry` table. There is nothing stored yet to write back for AC1, and
  deciding how/when to persist them (every case-detail view? only the nightly scoring
  run? how is dedup handled across repeated views of the same case?) is a separate,
  unscoped architectural decision — see Open Questions. **AC1 is not claimed as done
  by this ticket.**
- **No new frontend/officer-facing UI.** Failures are surfaced via a queryable admin
  endpoint only, mirroring the `/api/admin/extract/history` precedent from #1/#2 —
  not a UI panel.
- **No change to `ActivityLogEntry` itself.** It already has no update/delete path
  exposed anywhere in the API — AC4's immutability requirement is already satisfied
  for every entry this ticket covers; this ticket just needs to keep its own new
  table (`write_back_attempt`) equally insert-only.

## User Stories → Acceptance Criteria

- [ ] **AC1** (every auto-generated activity log entry from #6 is pushed) — **deferred**,
      see Non-Goals and Open Questions. Not addressed this pass.
- [ ] **AC2** (every officer decision is pushed with the officer's identity and
      timestamp) — `DecisionService.decide()` calls
      `ActivityLogWriteBackService.recordAndAttempt(entry)` immediately after saving
      the `ActivityLogEntry`, which already carries `decidedBy`/timestamp in its text
      and source fields.
- [ ] **AC2b** (reminder-cadence dispatch entries, #9, are pushed the same way) —
      `ReminderCadenceService` gets the same hook after its own
      `activityLogEntryRepository.save(...)` call.
- [ ] **AC3** (write-back failures are retried and surfaced, not silently dropped) —
      every attempt (success or failure) writes a `WriteBackAttempt` row; a scheduled
      sweep retries recent failures up to a max attempt count; entries that exhaust
      retries are queryable via `GET /api/admin/writeback/failures`.
- [ ] **AC4** (entries written are immutable, no update/delete path) — `ActivityLogEntry`
      already satisfies this; `WriteBackAttempt` is insert-only by design (a retry
      creates a new row, nothing is ever updated).

## Technical Design → Architecture

- **`ActivityLogWriteBackAdapter`** (port interface) —
  `WriteBackResult attemptWrite(ActivityLogEntry entry)`.
- **`MockActivityLogWriteBackAdapter`** (the only implementation for now) — simulates
  the call; stands in for the real ITS Integrator write-back endpoint, which does not
  exist yet (#1/#33).
- **`WriteBackAttempt`** domain entity — `id` (UUID), `activityLogEntryId` (UUID),
  `attemptNumber` (int), `status` (`SUCCESS`/`FAILED`), `errorMessage` (nullable),
  `attemptedAt` (Instant). Insert-only.
- **`ActivityLogWriteBackService`**:
  - `recordAndAttempt(ActivityLogEntry entry)` — called by producers right after they
    save an entry. Calls the adapter once, synchronously; a thrown exception from the
    adapter is caught and converted into a failed `WriteBackResult` *before*
    recording — a throwing adapter must still produce a row, otherwise the entry
    would silently vanish from both the sweep and the failures endpoint.
  - `@Scheduled` retry sweep (every 15 minutes) — finds entries whose latest attempt
    is `FAILED` and attempt count < 3, retries via the adapter, records a new
    `WriteBackAttempt` row each time. After 3 attempts, an entry stays `FAILED`
    permanently and is not retried again automatically — surfaced for a human to see
    rather than looping forever.
  - Delegates the actual row write to `WriteBackAttemptRecorder.record(...)`, a
    separate bean running with `@Transactional(propagation = REQUIRES_NEW)` — a real
    Spring proxy boundary, not a self-invoked private method (which would silently
    ignore `REQUIRES_NEW`). This guarantees a DB-level failure while recording an
    attempt runs in its own isolated transaction and can never roll back the officer
    decision or reminder dispatch that triggered it.
- **`WriteBackAttemptRecorder`** — the only thing that calls
  `writeBackAttemptRepository.save(...)`, in its own `REQUIRES_NEW` transaction.
- **`WriteBackAdminController`** — `GET /api/admin/writeback/failures`, mirroring
  `AdminExtractController`'s shape.
- **Wiring** — `DecisionService` and `ReminderCadenceService` each get
  `ActivityLogWriteBackService` injected and call `recordAndAttempt(savedEntry)`
  right after their existing `activityLogEntryRepository.save(...)` call.

## Technical Design → Data Model

New table `write_back_attempt` (Liquibase `007-write-back-attempt.xml`):

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `activity_log_entry_id` | UUID | NOT NULL — references `activity_log_entry.id`, no enforced FK cascade (audit table) |
| `attempt_number` | INT | NOT NULL |
| `status` | VARCHAR | NOT NULL — `SUCCESS` \| `FAILED` |
| `error_message` | TEXT | nullable |
| `attempted_at` | TIMESTAMP | NOT NULL |

Unique constraint on `(activity_log_entry_id, attempt_number)` — guards against a
double-processed sweep (e.g. overlapping runs with no distributed lock) inserting two
rows for the same entry's next attempt number; the losing insert fails loudly with a
constraint violation instead of silently duplicating a write-back.

No change to `activity_log_entry`'s schema.

## API Design

`GET /api/admin/writeback/failures` → list of
`{ activityLogEntryId, debtorKey, text, attemptCount, lastAttemptedAt, lastError }`
for entries whose latest attempt is `FAILED` and attempt count has reached the max.

## Testing Strategy

- **Unit (`ActivityLogWriteBackServiceTest`):** a successful attempt records one
  `SUCCESS` result; a failing adapter records a `FAILED` result and does not throw; a
  *throwing* adapter is also recorded as a failed attempt, not lost; the scheduled
  sweep only re-attempts entries below the max attempt count; after the max, the sweep
  leaves the entry alone (no further rows, no infinite retry); a recorder failure
  during the sweep doesn't abort the rest of the loop; the latest-attempt grouping is
  deterministic regardless of row order or ties.
- **Unit (`WriteBackAdminControllerTest`):** the failures endpoint enriches each
  exhausted attempt from its source `ActivityLogEntry`, returns an empty list when
  nothing has exhausted retries, and degrades gracefully if the source entry is gone.
- **Unit (extend `DecisionServiceTest`/`ReminderCadenceServiceTest`):** verify
  `recordAndAttempt` is called with the just-saved entry.
- **Integration (`WriteBackAttemptIntegrationTest`, real H2 context):** a full
  attempt-and-retry cycle, verifying `WriteBackAttempt` rows accumulate (new row per
  attempt, never updated) — mirrors `NightlyExtractIdempotencyTest`'s precedent.

## Metrics & Success Criteria

- AC2, AC2b, AC3, AC4 covered by passing tests; AC1 explicitly deferred, not claimed
  as done.
- No regression to #13's or #9's existing behavior — both succeed even when
  write-back fails; write-back is best-effort and never blocks the primary action.

## Risks & Mitigations

- **Risk:** a write-back failure could block or fail the officer's decision /
  reminder dispatch if not isolated. **Mitigation:** `recordAndAttempt` catches all
  exceptions internally, and the actual row write runs in `WriteBackAttemptRecorder`'s
  own `REQUIRES_NEW` transaction — a DB-level failure there cannot poison or roll back
  the caller's existing transaction (this was a real, confirmed bug in an earlier
  version of this change, found by adversarial review: `@Transactional` with default
  propagation on `recordAndAttempt` joined the caller's transaction instead of
  isolating from it).
- **Risk:** an adapter that throws instead of returning a `WriteBackResult` (realistic
  for an HTTP-based real client — timeouts, connection errors) could silently drop the
  entry from both the retry sweep and the failures endpoint forever, with no row ever
  recorded. **Mitigation:** the adapter call is wrapped in its own try/catch inside
  `attempt()`, converting a thrown exception into a failed result *before* recording —
  also a confirmed bug caught by adversarial review before merge.
- **Risk:** two overlapping sweep runs (no distributed lock) could both read the same
  "latest = FAILED" state and double-insert the next attempt number. **Mitigation:** a
  unique constraint on `(activity_log_entry_id, attempt_number)` — the losing insert
  fails with a constraint violation (caught and logged) rather than silently
  duplicating a write-back. Full distributed locking is out of scope, consistent with
  the rest of this codebase's scheduled jobs (`NightlyExtractService`,
  `ReminderCadenceService` have the same gap).
- **Risk:** without a real ITS Integrator endpoint, passing tests only prove the
  retry/logging plumbing, not actual interoperability. **Mitigation:** same accepted
  risk the team already took for #1/#2 — flagged in the PR description, not hidden.

## Open Questions

1. **Should #6's auto-generated scoring signals be persisted as real
   `ActivityLogEntry` rows at all, and if so, when** (every case-detail API call, or
   only the nightly scoring run)? This blocks AC1 and needs a product/architecture
   decision — recommend a follow-up ticket once answered, rather than guessing here.
2. **Retry cadence/max attempts** — this spec assumes every 15 minutes, max 3
   attempts, matching the config's `workflow.max_retries_per_stage: 3`. Flagged in
   the PR for the team to confirm or adjust.
