# Case Signals, Evidence Chips & Activity Log Specification

**Status:** Implemented
**Owner:** Ndumiso Mpanza
**Created:** 2026-09-08
**Last Updated:** 2026-09-08 (all acceptance criteria verified by automated tests + manual e2e against the real docker-compose stack; see Testing Strategy)

## Overview

Every case shown to a debt officer must carry three distinct pieces of trust-building context so
the officer can verify a recommendation quickly rather than take it on faith: at-a-glance
**signal chips** on the worklist row, read-only **evidence chips** on the case detail, and a
running **activity log** of what the agent read/found during scoring. Implementation of all three
already exists (`CaseAssemblyService.signalsOf/evidenceOf/activityOf`, wired through
`RowAssembler` and `CaseService`), ported directly from the prototype. This spec covers verifying
that implementation against `TECHNICAL_SPECIFICATION.md` §4.4/§4.5/§4.6 rule-by-rule, closing one
real architectural gap found during review (see Open Questions), and adding the automated test
coverage that currently does not exist for any of `CaseAssemblyService`, `CaseService`, or
`ActivityLogEntry`.

## Goals

- Confirm `CaseAssemblyService.signalsOf()` matches §4.4 exactly: signal order, wording, and which
  signals are flagged "hot".
- Confirm `CaseAssemblyService.evidenceOf()` matches §4.5 exactly: chip order and wording.
- Confirm `CaseAssemblyService.activityOf()` matches §4.6 exactly: entry order, wording, and
  source attribution.
- Confirm the append-only guarantee: persisted `ActivityLogEntry` rows (currently written only by
  `DecisionService` for officer decisions, per #13) are never updated or deleted anywhere in the
  codebase.
- Add automated test coverage (unit + integration) proving each acceptance criterion, since none
  currently exists for this service.
- Produce e2e evidence (real docker-compose stack, real seed data) that the API-surfaced signals,
  evidence and activity match hand-derived expectations for known debtors.

## Non-Goals

- The nightly scoring-run trigger/scheduler itself — this is
  [issue #2](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/2)
  ("Extract nightly debtor data from ITS Integrator into the Debt Tracker data model"), assigned
  to Linda50-adaptit, and not yet implemented (no `@Scheduled` job exists anywhere in the backend
  today). #6 only owns generating the correct signal/evidence/activity content from whatever
  `Debtor` row exists at read time — see Open Questions for how this interacts with the
  "append-only, each run" requirement.
- Writing the agent/officer action audit trail for actions other than scoring (e.g. registration
  holds, hardship-fund referrals) — that is
  [issue #3](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/3) ("Write
  agent and officer actions back to the ITS Integrator student activity log").
- The decision engine's own recommendation/rationale text (#7) — #6 only covers the signal/
  evidence/activity chips, not the recommendation itself.
- Wiring the Angular frontend to the live API — it remains on `core/mock-data.ts` per current
  architecture.

## User Stories

### As a debt officer, I want each flagged case to show me at-a-glance signals, the evidence behind the score, and a running activity log, so that I can trust and verify the recommendation quickly

**Acceptance Criteria:**
- [x] Signals generated in order: missed instalments (hot), last-payment/no-payment (hot if
      none), oldest overdue bucket or arrears (hot if 90+/120+), funding status if risk weight
      >= 8, "Arrangement defaulted" (hot) if applicable — `CaseAssemblyServiceTest` (16 cases,
      including the ageing-priority chain and every boundary); confirmed live against
      `STU-100301-2026` (`GET /api/debtors?scope=cases`) via the docker-compose e2e check
- [x] Evidence chips generated: ageing (oldest non-zero bucket), payment history year range,
      funding status, arrangement (if any) — `CaseAssemblyServiceTest` /
      `CaseServiceTest.seededDebtorEvidenceAndActivityMatchHandDerivedExpectations`; confirmed
      live via the docker-compose e2e check
- [x] Activity log entries auto-generated each run: risk scored + banded (Risk Sentinel), funding
      status read (Funding Broker), missed instalments flagged if any (Assurance Agent), last
      receipt confirmed or none found (Cashiering reconciliation), prior arrangement status if
      any (Assurance Agent) — same tests as above; confirmed live
- [x] Activity log is append-only — a new run adds entries, it does not overwrite or delete prior
      ones — resolved per the Open Question below: the persisted trail (officer decisions, #13,
      plus the seeded "nightly extract" entry) is genuinely append-only (no delete/update path
      exists on `ActivityLogEntryRepository`, confirmed by inspection); the read path never
      writes, proven by `CaseServiceTest.readingCaseDetailTwiceDoesNotDuplicatePersistedActivityLogEntries`
      and by a live before/after persisted-row-count check against the real Postgres container

## Technical Design

### Architecture

No new components expected; existing pipeline, to be verified against spec:

```
DebtorRepository (JPA/Postgres, real data)
  -> RowAssembler.toRow(Debtor, fundingRiskWeights)
       -> CaseAssemblyService.signalsOf(Debtor, fundingRiskWeights)   // §4.4, computed on read
  -> DebtorRowDto (signals field) -> GET /api/debtors

  -> CaseService.detailFor(debtorKey)
       -> CaseAssemblyService.evidenceOf(Debtor)                      // §4.5, computed on read
       -> CaseAssemblyService.activityOf(Debtor, score, band)         // §4.6, computed on read
       -> ActivityLogEntryRepository.findAllByDebtorKeyOrderByCreatedAtDesc(debtorKey)
            // §4.6-adjacent: persisted officer-decision entries, written by DecisionService (#13)
  -> CaseDetailDto (evidence, activity fields) -> GET /api/debtors/{debtorKey}
```

`CaseAssemblyService` in
`backend/src/main/java/com/adaptit/studentdebt/service/CaseAssemblyService.java` already
implements every rule in §4.4/§4.5/§4.6 line-for-line, confirmed by inspection against the spec
text (see Testing Strategy for the rule-by-rule cross-check). This ticket's main remaining work is
verification (tests), not new signal/evidence/activity logic — with one exception, below.

### Data Model

No schema changes expected. Existing tables used as-is:
- `debtor` — read-only source for signals/evidence, same fields #4/#5 already rely on.
- `activity_log_entry` (`ActivityLogEntry` entity) — already exists, already append-only in
  practice (only `DecisionService` calls `.save()`; no `delete`/update path exists anywhere in the
  codebase, confirmed by inspection). At runtime, only ever populated by officer-decision entries
  (#13); the five §4.6 scoring-run entries stay computed-on-read (see Open Questions). Note: the
  Liquibase seed data (`004-seed-activity-log.xml`) pre-populates one `"Nightly extract loaded
  from Debtors, Student Fees and Cashiering"` / `"Debt Tracker Service · nightly extract"` row per
  seeded debtor, confirming the intended design already anticipates a real nightly job (#2)
  eventually writing to this table — reinforcing that this is #2's responsibility, not #6's.

### API Design

No new endpoints expected.
- `GET /api/debtors` (any `scope`) already returns `signals` on each `DebtorRowDto`.
- `GET /api/debtors/{debtorKey}` already returns `evidence` and `activity` on `CaseDetailDto`.

### UI/UX Design

Out of scope — frontend is not wired to this API yet.

## Implementation Plan

Approved and executed (Gate 1) — see `specs/issue-6-implementation-plan.md` for the step-by-step
plan. No production code changes were required; all 4 acceptance criteria were already correctly
implemented, and this ticket closed on test coverage + verification alone (same pattern as #4).

## Testing Strategy — results

All tests below were written and executed; results recorded here rather than kept as a separate
plan-vs-actual document.

- **Unit tests**: `backend/src/test/java/com/adaptit/studentdebt/service/CaseAssemblyServiceTest.java`
  — 26 tests, all passing, covering every acceptance criterion and boundary listed below.
- **Integration tests (real-data pipeline + append-only proof)**:
  `backend/src/test/java/com/adaptit/studentdebt/web/CaseServiceTest.java` — `@SpringBootTest` +
  `MockMvc` against the H2/Liquibase test profile, hitting the real `GET /api/debtors` and
  `GET /api/debtors/{debtorKey}` endpoints — 3 tests, all passing, including a test that reads
  case detail twice and asserts the persisted `activity_log_entry` row count is unchanged.
- **Full regression**: `./mvnw clean test` — 40 tests total, 0 failures (a stale, un-cleaned
  `target/` initially showed misleading results from other branches' compiled test classes;
  `clean test` gave the accurate count for this branch's actual content).
- **E2E** (existing `docker compose` stack, real Postgres container — no rebuild needed since no
  production code changed):
  - `GET /api/debtors?scope=cases&year=2026` → `STU-100301-2026` signals matched exactly:
    `"4 missed instalments"`, `"No payment on record"`, `"120+ days R 33 500"` (confirmed
    `MoneyFormat.r()` uses space grouping, not commas — validates using the real formatter rather
    than a hardcoded string in the unit/integration tests), `"NSFAS declined"`,
    `"Arrangement defaulted"`, all hot flags correct.
  - `GET /api/debtors/STU-100301-2026` → evidence and all 6 activity entries (5 computed + 1
    persisted seed entry) matched exactly, in order.
  - Adversarial: `GET /api/debtors/STU-100355-2026` (a credit debtor with no arrangement, no
    missed instalments) — confirmed no `"null"` text anywhere in evidence/activity, and the
    conditional entries (arrangement, missed-instalments) were correctly absent rather than empty.
  - Append-only, against the real Postgres container directly (`psql` inside
    `student-debt-tracker-db`): `select count(*) from activity_log_entry where debtor_key =
    'STU-100301-2026'` was `1` both before and after two live `GET
    /api/debtors/STU-100301-2026` calls — the read path never writes, confirmed outside the test
    harness too.

Original pre-implementation plan (for reference):

- **Unit tests** (`CaseAssemblyServiceTest`, new — none currently exist):
  - `signalsOf`: one case per signal rule in isolation and stacked together, in the exact §4.4
    order — missed instalments (0, 1, >1 for pluralization), payment date null vs. populated,
    each ageing-priority branch (d120 present vs. d90-only vs. arrears-only vs. none), funding
    status at/above/below the risk-weight-8 threshold, arrangement `"Defaulted"` in various
    casings vs. other/null values.
  - `evidenceOf`: oldest-non-zero-bucket selection at each bucket boundary (including the
    all-zero → `"Ageing · Current"` fallback), payment-history year-range formatting, funding
    status chip, arrangement chip present/absent.
  - `activityOf`: entry order, wording and source string for each of the five rules, including
    the two conditional entries (missed instalments, prior arrangement) both present and absent.
- **Integration test** (`CaseServiceTest` or `DebtorControllerTest` extension): confirms
  `GET /api/debtors/{debtorKey}` merges the live-computed scoring-run activity entries with
  persisted `ActivityLogEntry` rows in the correct order, against the H2 test profile.
- **Append-only verification**: a test that calls `CaseService.detailFor()` (or hits the
  endpoint) twice in a row and confirms persisted entry count is unchanged between calls (no
  duplicate writes from a read-only path), plus an inspection-based check (already done, see
  Data Model) that no delete/update path exists on `ActivityLogEntryRepository`.
- **E2E** (`docker compose up -d --build`, real Postgres container): hit
  `GET /api/debtors?scope=cases` and manually verify signal chips/order for a handful of known
  seeded debtors against hand-derived expectations; hit `GET /api/debtors/{debtorKey}` for the
  same debtors and verify evidence + activity content and order.
- **Adversarial cases to include**: a debtor with every optional field null (`arrangementStatus`,
  `lastPaymentDate`, all ageing buckets zero) — confirm no signal/evidence/activity entry throws
  or renders `"null"`; a debtor with an unrecognized funding status string (must not throw, must
  simply not clear the risk-weight-8 threshold); a debtor whose only overdue bucket is exactly at
  a rule boundary (e.g. d120 == 0.01 vs. exactly 0).

## Rollout Plan

No rollout needed — logic is already deployed as part of the existing backend build. This work
added verification only; no behavior change occurred, since all four acceptance criteria were
already correctly implemented.

## Metrics & Success Criteria

- Every acceptance-criteria checkbox above has a passing automated test that would fail if the
  rule were violated. **Met** — 26 unit tests + 3 integration tests, 0 failures.
- E2E spot-check against real seeded Postgres data matches hand-derived expected signals/evidence/
  activity with zero discrepancies. **Met** — see Testing Strategy — results.

## Dependencies

- `funding_status_risk_weight` seed data (`002-seed-lookups.xml`), same as #4/#5.
- H2 test profile (`ddl-auto: none`, per `backend/README.md`) for the integration test tier.

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Existing implementation has a subtle deviation from §4.4/§4.5/§4.6 not caught by inspection | Officer loses trust in a case's evidence trail, or misses a hot signal | Low | Exhaustive unit tests per rule, including boundaries, before closing the ticket (same approach as #4) |
| Seed data doesn't exercise every signal/evidence branch (e.g. no seeded debtor with a `d90`-only, arrears-only case) | Gaps in E2E confidence even if unit tests pass | Medium | Cross-check seed data coverage during implementation; add fixtures if gaps found (same approach as #4) — confirmed `STU-100301-2026` exercises the full stack |

## Open Questions

- [x] **Does "activity log is append-only — a new run adds entries" require the five §4.6
      scoring-run entries to be persisted per run, or is computing them live on every read (the
      current design) an acceptable interim substitute until #2 (nightly extract/scheduler)
      exists?** Resolved: narrow reading confirmed by the user — "append-only" describes the
      persisted trail (officer decisions from #13, plus the seeded nightly-extract entry), which
      already satisfies it; the five computed-on-read scoring entries are correct as-is for #6.
      No new persistence work was done. Follow-up noted for #2 to call a persistence path once a
      real nightly run exists.

## References

- [Issue #6](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/6)
- `TECHNICAL_SPECIFICATION.md` §4.4 (Signals), §4.5 (Evidence), §4.6 (Activity log)
- `backend/src/main/java/com/adaptit/studentdebt/service/CaseAssemblyService.java` (existing implementation)
- `backend/src/main/java/com/adaptit/studentdebt/service/RowAssembler.java`,
  `CaseService.java` (real-data pipeline)
- `backend/src/main/java/com/adaptit/studentdebt/domain/ActivityLogEntry.java`,
  `repository/ActivityLogEntryRepository.java` (persisted, append-only audit trail)
- `specs/issue-4-risk-scoring.md` (precedent for handling an out-of-scope upstream dependency on #2)
