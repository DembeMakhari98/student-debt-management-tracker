# Spec: Dispatch the reminder cadence for single-missed-instalment cases

**Ticket:** [#9](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/9)
**Branch base:** `develop`
**Spec reference:** TECHNICAL_SPECIFICATION.md §2 (Notification Dispatcher), §5.7 Rule 7,
§5.10 (autonomy gating), open item 11

## Overview / Goals

As a student with a single missed instalment, I want a low-friction reminder cadence
rather than an immediate hold, so that I get a fair chance to resolve it before harsher
action is taken.

The decision engine (issue #7) already recommends `"Reminder cadence"` (Rule 7) for
every case with exactly one missed instalment, and the autonomy gate (issue #8) already
decides whether the system may act on it automatically. What's missing is the
**Notification Dispatcher** itself: the component that turns that recommendation into
the actual three-step cadence over time — SMS on day 1, WhatsApp on day 5, an officer
call task on day 10 — and records each step on the case's activity log.

## Non-Goals

- **No real SMS/WhatsApp dispatch.** Same scope decision issue #14 made for the manual
  engagement buttons: no live gateway is confirmed. WhatsApp's target provider (Cuedesk,
  per #14) is known but not integrated; SMS is still unconfirmed (technical spec open
  item 11 — issue #21 answered browser support and tech stack only, not the messaging
  gateway). Each step is **simulated**: recorded as an activity log entry, not sent
  through a provider. Swap the simulated dispatch calls for a real client once a
  provider is confirmed — nothing else in either implementation needs to change.
- **No new "Case Store" entity/table beyond cadence bookkeeping.** The architecture's
  general Case Store (technical spec §2) doesn't exist yet — cases are computed on read
  from `Debtor` + `ActivityLogEntry`/`OfficerDecision` (see issue #6's implementation
  plan). This ticket adds the one piece of persisted state it strictly needs: how far
  each case's cadence has progressed, and since when.
- **No officer call task system.** "Officer call task created" (day 10) is recorded the
  same way the other two steps are — an activity log entry — not a real task/ticket in
  an external system. There is no task tracker to integrate with today.
- **No backend/frontend wiring.** Same standing scope boundary as #14: the Angular app
  has no `HttpClient` usage anywhere. This ticket implements the dispatcher twice,
  independently — a Spring service on the backend, a mirrored method on `DebtService` on
  the frontend — the same pattern issues #7, #8 and #13 already established.

## User Stories → Acceptance Criteria

- [x] Step 1: SMS sent on day 1 of the case being opened
- [x] Step 2: WhatsApp message sent on day 5 if unresolved
- [x] Step 3: officer call task created on day 10 if still unresolved
- [x] Cadence only auto-executes when autonomy level permits (see #8) — otherwise it is
      queued for approval
- [x] Each dispatched message is recorded as an activity log entry (#3, #6)
- [x] Uses Adapt IT's existing SMS/WhatsApp gateway if one exists — none is confirmed
      (see Non-Goals); simulated the same way #14 simulates its manual sends

## Technical Design → Architecture

**"Day of the case being opened"** has no existing anchor — there is no case-lifecycle
store, and a `Debtor` row is a nightly snapshot re-extracted in place (`missedInstalments`
just changes value; there's no history). Both implementations add a small piece of state
to anchor the clock: a case's cadence "starts" the first time it's observed with a
`"Reminder cadence"` recommendation, and that start time persists (backend: a DB row;
frontend: a session-lifetime signal map, same lifecycle as `engagementLog`/`decisions`
from #13/#14) until the case resolves or escalates to a different rule, at which point
its progress is deleted/cleared — a later relapse starts a fresh clock rather than
resuming a stale one.

**Backend** — `ReminderCadenceService` (`backend/.../service/ReminderCadenceService.java`):
- `@Scheduled` nightly (`0 0 2 * * *`, after the nightly scoring pass would refresh
  `missed_instalments`), calling a testable `dispatch(debtors, autonomyLevel, now)` core.
- For every debtor: run the decision engine; if the recommendation isn't
  `REMINDER_CADENCE`, delete any in-flight `ReminderCadenceProgress` row and move on.
  Otherwise get-or-create the progress row (`startedAt = now` if new).
- `AutonomyGateService.autoEligible(rec, level)` gates dispatch — same predicate #8
  already built. When ineligible, the row is still created/kept (the clock runs) but no
  step fires — the case sits queued, same as any other `"Agent acting"` recommendation at
  Level 2.
- When eligible, each step whose due day (1 / 5 / 10) has elapsed and hasn't fired yet is
  dispatched in the same pass — a service outage of a few days doesn't lose steps, it
  catches up on the next run — and written as an `ActivityLogEntry`
  (`source = "Engagement Agent · Reminder cadence"`).

**Frontend** — `DebtService.runReminderCadence(now = new Date())` (mirrors the same
logic against the mock dataset, iterating the existing private `allCases()` — the same
unfiltered pool `runAutonomousExecution()` (#8) uses, not the officer's current view).
`now` is an injectable parameter so cadence-day thresholds are testable without faking
the system clock.

## Technical Design → Data Model

New backend table `reminder_cadence_progress` (Liquibase `005-create-reminder-cadence-progress.xml`):

| Column | Type | Notes |
|---|---|---|
| `debtor_key` | varchar(40), PK | FK to `debtor.debtor_key` |
| `started_at` | timestamptz, not null | When this case's cadence clock started |
| `step1_sent_at` | timestamptz, nullable | SMS dispatched |
| `step2_sent_at` | timestamptz, nullable | WhatsApp dispatched |
| `step3_sent_at` | timestamptz, nullable | Officer call task created |

Frontend equivalent: `CadenceProgress` (`frontend/src/app/core/models.ts`), same four
fields as ISO 8601 strings, keyed by debtor id in a `Map` on `DebtService`.

## API Design

None. Like the retention policy (#20), this is an internal scheduled job with no HTTP
surface — tested by calling the dispatch method directly (see `ReminderCadenceServiceTest`).

## Testing Strategy

- **Backend (`ReminderCadenceServiceTest`, plain JUnit + Mockito, no Spring context —
  same pattern as `DecisionServiceTest`/`RetentionPolicyServiceTest`):** day-0 start with
  no dispatch; day-1 dispatches step 1 only; a multi-day catch-up in one run dispatches
  every step that's newly due; already-sent steps are never resent; Level 2 never
  dispatches but still starts/keeps the clock; Level 3 dispatches (Reminder cadence is
  Agent-acting); Level 4 dispatches; a resolved case (missed back to 0) cancels its
  progress; a case escalated to a different rule (missed ≥ 2) cancels its progress; no
  progress and no-longer-eligible is a no-op.
- **Frontend (`debt.service.spec.ts`):** the same scenarios, against a real mock-dataset
  case (`STU-100288`, Bursary partial + 1 missed instalment → confirmed via a sanity test
  to resolve to `"Reminder cadence"`, since `runReminderCadence()` reads the shared
  `DEBTORS` array the same way `runAutonomousExecution()`'s tests do, not synthetic
  `debtor()` fixtures).
- **Full regression:** `./mvnw test` (backend, 110/110 passing) and
  `ng test --watch=false` (frontend, 74/74 passing) both run clean after this change.

## Metrics & Success Criteria

- All 6 acceptance criteria checked off above, each tied to a specific test.
- No regression to #7 (decision engine), #8 (autonomy gate), #13 (officer decisions), or
  #14 (engagement panel) — their existing suites pass unchanged.

## Risks & Mitigations

- **Risk:** "day of the case being opened" is a genuinely new concept with no existing
  data to back it (no historical extraction timestamps). **Mitigation:** anchored to
  first-observation rather than inferred from data that doesn't exist; documented here
  and in the `ReminderCadenceProgress`/`ReminderCadenceService` Javadoc so a future
  engineer wiring in the real nightly extraction job (#1/#2, still open) understands the
  assumption.
- **Risk:** simulated dispatch could be mistaken for a real integration once this ships.
  **Mitigation:** same mitigation #14 used — explicit Non-Goals here, a code comment at
  the simulated-dispatch call sites, and the activity log entries themselves are
  factually accurate ("sent"/"created") for a case where the officer already treats
  manual engagement-panel actions the same way.

## Open Questions

*(carried from #14's Open Question 3, still unresolved)*

1. **SMS gateway** — technical spec open item 11. WhatsApp is answered (Cuedesk, per
   #14); SMS is not. Blocks turning the simulated dispatch into a real one.
2. **Officer call task system** — no ticket or system currently owns "day 10" call tasks
   beyond an activity log entry. If a real task/queue system is intended, that's a
   separate integration this ticket doesn't build.
