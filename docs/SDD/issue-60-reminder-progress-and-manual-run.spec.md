# Reminder Cadence — Progress Read and Manual Run Specification

**Status:** Implemented
**Owner:** Oamogetswe-Makgopela
**Created:** 2026-10-22
**Last Updated:** 2026-10-22

## Overview

`ReminderCadenceService` (issue #9) already runs the three-step reminder cadence — SMS day 1,
WhatsApp day 5, officer call day 10 — every night at 02:00 and stores each case's progress in
`reminder_cadence_progress`. Nothing can read that progress and nothing can trigger a run. This
feature adds two API endpoints: one for officers to see where each case is in the cadence, and one
for managers to run the same pass on demand.

Ticket: [#60](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/60)
Epic: [#22](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/22)
Builds on: #9 (cadence), #55 (portfolio scope), #62 (full-portfolio audit), #8 (autonomy gating)

## Goals

- `GET /api/reminders/progress` returns the cadence rows, scoped like #55 (`portfolio=own|team|all`,
  default `own`).
- `POST /api/admin/reminders/run` runs the same dispatch pass as the 02:00 job and returns what it did.
- The manual run is MANAGER / ADMIN only.
- Tests cover both endpoints, the scoping, the role rule and the audit.

## Non-Goals

- **No frontend.** #60 is an API story; a screen that shows this is a separate issue.
- **No change to the cadence rules,** the day thresholds (1 / 5 / 10), the 02:00 schedule, or the
  autonomy gate. A manual run is the *same* pass: at the default Level 2 it dispatches nothing,
  because the gate withholds it, exactly as the nightly job does. It does not bypass the day
  thresholds either; it only runs the pass now.
- **No new table or migration.** `reminder_cadence_progress` is read as it is.
- **No real SMS / WhatsApp gateway** (technical spec open item 11). Dispatch stays the simulated
  activity-log entry plus write-back that #9 built.
- **No year / funding filters** on the progress endpoint.

## User Stories

### As a debt officer, I want to see where each of my cases is in the reminder cadence

**Acceptance Criteria:**
- [ ] `GET /api/reminders/progress` returns one row per case in `reminder_cadence_progress`
- [ ] The default is `portfolio=own`; `team` returns the caller's team; `all` is MANAGER / ADMIN only
      (an officer gets 403, a bad value gets 400) — the same rules as `/api/debtors`
- [ ] The scope comes from the login token, never from request parameters
- [ ] Each row shows the case, the owner, when the cadence started, which steps were sent and when,
      and the next step and when it is due

### As a manager, I want to run the cadence on demand

**Acceptance Criteria:**
- [ ] `POST /api/admin/reminders/run` runs the dispatch pass (the code behind `runNightlyDispatch()`)
- [ ] It returns what happened: the steps dispatched, plus counts of cases withheld by the autonomy
      level and cadences cancelled
- [ ] An officer gets 403 and an unauthenticated caller 401
- [ ] A second run straight after dispatches nothing new (each step is sent once)

## Technical Design

### Architecture

```
GET  /api/reminders/progress?portfolio=      POST /api/admin/reminders/run
        │  (any signed-in user)                     │  (/api/admin/** → MANAGER/ADMIN, SecurityConfig)
        ▼                                           ▼
ReminderCadenceController (web)  ──────────────────────────────────────────
        │                                           │
        ▼                                           ▼
ReminderProgressService (new, read-only)     ReminderCadenceService.runNightlyDispatch()
  progress rows ⨝ debtor, filtered by          — now returns a ReminderRunResultDto
  PortfolioResolver → Portfolio.includes()       instead of void; same pass as the 02:00 job
```

### Data Model

No schema change. New response records in `dto/`:

- `ReminderProgressRowDto(debtorKey, studentName, assignedOfficer, startedAt, step1SentAt,
  step2SentAt, step3SentAt, stepsSent, nextStep, nextStepDueAt)` — `nextStep` is 1–3, or null when
  all three are sent; `nextStepDueAt` is `startedAt` plus that step's due day.
- `ReminderRunResultDto(ranAt, autonomyLevel, dispatchedCount, withheldCount, cancelledCount,
  dispatched)` with `DispatchedStepDto(debtorKey, step, action)`.

### API Design

| Endpoint | Who | Result |
|---|---|---|
| `GET /api/reminders/progress?portfolio=own\|team\|all` | any signed-in user | `200` list, oldest cadence first |
| same, `portfolio=all` as an officer | — | `403` |
| same, `portfolio=bogus` | — | `400` |
| `POST /api/admin/reminders/run` | MANAGER / ADMIN | `200` `ReminderRunResultDto` |
| same as an officer | — | `403` |
| either, no token | — | `401` |

### Audit (#62)

A `portfolio=all` view must be recorded in `portfolio_escalation` like the other four scoped
endpoints. `WebConfig` registers the audit interceptor on a fixed list of paths, so
`/api/reminders/progress` is added to it. Without that, the new endpoint would be a full-portfolio
view that escapes the audit.

## Implementation Plan

### Phase 1: Result of a run
- [ ] `ReminderCadenceService.dispatch(...)` collects what it does (dispatched steps, withheld,
      cancelled) and returns a `ReminderRunResultDto`; `runNightlyDispatch()` returns it. The
      `@Scheduled` annotation, the day thresholds and the dispatch logic are unchanged.

### Phase 2: Read side
- [ ] `ReminderProgressService.progress(Portfolio)` joins progress rows to debtors and filters with
      `Portfolio.includes(debtor)`; rows whose debtor no longer exists are skipped.
- [ ] `ReminderProgressRowDto`, `ReminderRunResultDto`, `DispatchedStepDto`.

### Phase 3: Controller and audit
- [ ] `ReminderCadenceController` with both endpoints; the portfolio comes from
      `PortfolioResolver.resolve(authentication, portfolio)`.
- [ ] Add `/api/reminders/progress` to the audited paths in `WebConfig`.
- [ ] Log who triggered a manual run.

### Phase 4: Tests
- [ ] `ReminderProgressServiceTest`: own / team / all scoping, unassigned cases only under `all`,
      orphan rows skipped, ordering, `stepsSent` / `nextStep` / `nextStepDueAt`.
- [ ] `ReminderCadenceServiceTest`: the result lists dispatched steps, counts withheld cases at
      Level 2 and cancelled cadences; existing tests keep passing.
- [ ] `ReminderCadenceControllerTest` (MockMvc, real seeded DB, transactional): officer scope rules
      (own default, `team`, `all` → 403, bad value → 400), manager `all`, manual run role gating
      (officer 403, manager and admin 200, no token 401), a second run dispatches nothing.
- [ ] `PortfolioEscalationAuditTest`: `/api/reminders/progress` with `portfolio=all` is recorded.

## Testing Strategy

- **Unit and web:** `./mvnw test` in `backend/`.
- **Manual (live):** start the backend on the in-memory database, sign in as an officer and as
  `grace.vanrooyen`, call both endpoints, and check the audit trail for the `all` view.

## Rollout Plan

Merge to `develop` via PR with reviewers. No flag. No frontend change, so nothing is visible in the
UI until a screen is built.

## Dependencies

#9 (cadence service), #55 (`PortfolioResolver`, `Portfolio`), #62 (audit interceptor), #8 (gate).
All merged.

## Risks & Mitigations

- **This changes two files other people own.** `ReminderCadenceService` (#9, thabiso2-4) gets a
  return value instead of `void`; `WebConfig` (#62, PhinduloMutavhatsindi27) gets one more audited
  path. Both are needed for this ticket (the issue says to return "what was dispatched", and the
  audit rule says every portfolio-scoped endpoint is audited). Both changes were approved at Gate 1.
  *Mitigation:* no behaviour change in either; the PR asks both owners to review.
- **The progress read loads the whole progress table and filters in memory** (two queries, no
  N+1). Fine at the current scale. If the table ever grows very large, push the scope filter into
  the query and add paging; no paging requirement exists today.
- **A manual run and the 02:00 run overlapping.** Each step is guarded by "not sent yet", but two
  transactions at the same moment could both dispatch one. *Mitigation:* unlikely; noted, not
  built (see Open Questions).
- **Default autonomy is Level 2,** so a manual run normally dispatches nothing and only creates or
  refreshes progress rows. The response says so (`withheldCount`) so it is not mistaken for a
  failure.

## Open Questions

1. **Audit the new endpoint's `all` view?** **Decided: yes.** One line in `WebConfig` adds
   `/api/reminders/progress` to the audited paths. The alternative, refusing `portfolio=all` here,
   would stop managers seeing the whole book of reminders.
2. **Guard against overlapping runs?** **Decided: no, not built.** An in-process lock that answers
   409 while a run is in progress can be added later if overlapping runs ever show up.

## References

- `ReminderCadenceService`, `ReminderCadenceProgress`, `CaseAutoResolveController` (#58, the closest
  precedent for a manager-triggered run), `PortfolioResolver`, `WebConfig`, `SecurityConfig`
- Technical spec §5.7 (reminder cadence), §5.10 (autonomy gating)
- Handover for #55 / #56 / #62 (portfolio scoping and audit rules)
