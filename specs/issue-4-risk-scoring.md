# Nightly Risk Score & Band Calculation Specification

**Status:** Implemented
**Owner:** Ndumiso Mpanza
**Created:** 2026-09-07
**Last Updated:** 2026-09-07 (all acceptance criteria verified by automated tests + manual e2e against the real docker-compose stack; see Testing Strategy)

## Overview

Every registered debtor with an outstanding balance must receive a 1–99 risk score and a
Watch / Elevated / High band each nightly scoring run, so debt officers can be shown the
highest-risk cases first. This is the scoring primitive that #5 (pick-up rule) and #6
(signals/evidence) build on. Implementation of the formula already exists in
`RiskScoringService`; this spec covers closing out #4 by verifying that implementation is
correct against the spec and against real persisted data, and adding the automated test
coverage that currently does not exist.

## Goals

- Confirm `RiskScoringService.score()` / `bandOf()` match `TECHNICAL_SPECIFICATION.md` §4.1/§4.2
  exactly, rule by rule.
- Confirm the scoring pipeline operates on real, persisted `Debtor` rows (Postgres via
  `DebtorRepository`, seeded by Liquibase) end-to-end through the API, not mock or in-memory
  substitutes.
- Add automated test coverage (unit + integration) proving each acceptance criterion, since none
  currently exists.
- Produce e2e evidence (real docker-compose stack, real seed data) that the API-surfaced
  `riskScore` / `band` fields are accurate for known debtors.

## Non-Goals

- Pick-up rule logic (#5) and signals/evidence/activity-log generation (#6) — separate tickets,
  even though they consume this score.
- Refund-case handling for in-credit debtors (#7).
- Wiring the Angular frontend to the live API — the frontend remains on `core/mock-data.ts` per
  current architecture; that is a separate, unscheduled effort.
- Nightly job scheduling/triggering mechanism — this is [issue #2](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/2)
  ("Extract nightly debtor data from ITS Integrator into the Debt Tracker data model"), assigned
  to Linda50-adaptit. #2 owns producing/refreshing the `Debtor` rows nightly (idempotent,
  failure-alerting, within the window confirmed in #1); #4 only owns scoring whatever `Debtor`
  rows exist at read time. Confirmed out of scope for #4 — no longer an open question.
- Changes to the funding-status risk weight values themselves (already seeded in
  `002-seed-lookups.xml`).

## User Stories

### As the Debt Tracker Service, I want to calculate a 1–99 risk score and a Watch/Elevated/High band for every debtor with an outstanding balance, so that officers can be shown the highest-risk cases first

**Acceptance Criteria:**
- [x] A debtor with no outstanding balance (`rowDebt <= 0`) always scores 0 and is not banded —
      `RiskScoringServiceTest.noOutstandingBalanceAlwaysScoresZero` /
      `.netCreditRowStillScoresZero`; confirmed live against real credit debtors
      (`STU-100355-2026`, `STU-100341-2026`) via the docker-compose e2e check
- [x] Score adds: `+18 + min(12, d120/4000)` if d120 > 0; `+14` if d90 > 0; `+8` if d60 > 0; `+5` if d30 > 0 —
      `RiskScoringServiceTest.d120AloneBelowCap` / `.d120AloneAtCap` / `.d90Alone` / `.d60Alone` /
      `.d30Alone` / `.allAgeingBucketsStacked`
- [x] Score adds: `min(22, missed * 7)` for missed instalments —
      `RiskScoringServiceTest.missedInstalmentsBelowCap` / `.missedInstalmentsJustUnderCap` /
      `.missedInstalmentsOverCapIsClampedAt22`
- [x] Score adds the funding-status risk weight from the lookup table (NSFAS declined=16, NSFAS
      lapsed=15, Bursary lapsed=14, NSFAS pending=12, Bursary partial=8, Self-funded=4, Bursary
      confirmed/overpaid=0, unknown status=0) —
      `RiskScoringServiceTest.everyFundingStatusWeightIsApplied` /
      `.unrecognizedFundingStatusDefaultsToZeroWeight`
- [x] Score adds `+10` if a prior arrangement is "Defaulted", and `+8` if there is no payment on record —
      `RiskScoringServiceTest.defaultedArrangementAddsTen` / `.defaultedArrangementMatchIsCaseInsensitive` /
      `.nonDefaultedArrangementAddsNothing` / `.noArrangementRecordAddsNothing` /
      `.noPaymentOnRecordAddsEight` / `.paymentOnRecordAddsNothing`
- [x] Final score is clamped to the range 1–99 —
      `RiskScoringServiceTest.scoreIsClampedAt99` / `.scoreFloorIsOneWhenNoSignalsFireButDebtIsOwed`
- [x] Band assigned: Watch (<45), Elevated (45–69), High (>=70) —
      `RiskScoringServiceTest.bandBoundaries`; confirmed live (`STU-100301-2026` → 96/HIGH,
      `STU-100234-2026` → 31/WATCH) via the docker-compose e2e check
- [x] A debtor in credit (owed to student) is never scored/banded by this logic — handled as a
      Refund case per #7 — `RowAssemblerTest.creditDebtorIsBandedCreditNotWatchElevatedOrHigh`;
      confirmed live against real seeded credit debtors, both returning `riskScore:0`/`riskBand:"CREDIT"`

All eight criteria verified by automated tests, and independently confirmed against real
Postgres-backed data via the full docker-compose stack (see Testing Strategy for the complete
e2e record).

## Technical Design

### Architecture

No new components. Existing pipeline, unchanged:

```
DebtorRepository (JPA/Postgres, real data)
  -> DebtorQueryService.rows()/pickedRows()/refundRows()/payingRows()
  -> RowAssembler.toRow(Debtor, fundingRiskWeights)
       -> RiskScoringService.score(Debtor, fundingRiskWeights)   // pure function, §4.1
       -> RiskScoringService.bandOf(score)                       // §4.2
  -> DebtorRowDto (riskScore, band fields)
  -> DebtorController (GET /api/debtors)
```

`RiskScoringService.score()` and `bandOf()` in
`backend/src/main/java/com/adaptit/studentdebt/service/RiskScoringService.java` already implement
every rule in §4.1/§4.2 line-for-line, confirmed by inspection against the spec text. This
ticket's remaining work is verification (tests), not new logic.

### Data Model

No schema changes. Existing tables used as-is:
- `debtor` (via `Debtor` entity) — ageing buckets, `missed_instalments`, `funding_status`,
  `arrangement_status`, `last_payment_date` already present and populated by
  `003-seed-debtors.xml`.
- `funding_status_risk_weight` — lookup table, seeded by `002-seed-lookups.xml`, read via
  `FundingStatusRiskWeightRepository`.

### API Design

No new endpoints. `GET /api/debtors` (any `scope`) already returns `riskScore` and `band` on each
`DebtorRowDto`, computed from real persisted data at request time.

### UI/UX Design

Out of scope — frontend is not wired to this API yet.

## Implementation Plan

Approved and executed (Gate 1) — see `specs/issue-4-implementation-plan.md` for the step-by-step
plan. No production code changes were required; all 8 acceptance criteria were already correctly
implemented, and this ticket closed on test coverage + verification alone.

## Testing Strategy — results

All tests below were written and executed; results recorded here rather than kept as a separate
plan-vs-actual document.

- **Unit tests**: `backend/src/test/java/com/adaptit/studentdebt/service/RiskScoringServiceTest.java`
  — 22 tests, all passing, covering every acceptance criterion and boundary listed below.
- **Integration test (credit exclusion)**:
  `backend/src/test/java/com/adaptit/studentdebt/service/RowAssemblerTest.java` — confirms a
  credit debtor is banded `CREDIT` with `riskScore == 0`, never Watch/Elevated/High.
- **Integration test (real-data pipeline)**:
  `backend/src/test/java/com/adaptit/studentdebt/web/DebtorControllerTest.java` — `@SpringBootTest`
  + `MockMvc` against the H2/Liquibase test profile, hitting the real `GET /api/debtors` endpoint
  and asserting `STU-100301-2026` → 96/HIGH and `STU-100234-2026` → 31/WATCH, matching
  hand-calculated expectations.
- **Full regression**: `./mvnw test` — 25 tests total, 0 failures.
- **E2E** (`docker compose up -d --build`, real Postgres container, not H2):
  - `GET /api/debtors?scope=cases&year=2026` → `STU-100301-2026` scored 96/HIGH,
    `STU-100234-2026` scored 31/WATCH — identical to the H2 integration test and hand calculation.
  - Adversarial: two real seeded credit debtors (`STU-100355-2026`, `STU-100341-2026`) both
    returned `riskScore:0`/`riskBand:"CREDIT"` against live data, confirming the credit-exclusion
    rule holds outside the unit test too.
  - Idempotency: restarted the `backend` container mid-session and re-hit the same endpoint — the
    JSON response was byte-for-byte identical, confirming scoring is stable/deterministic and not
    dependent on any in-memory state.

Original pre-implementation plan (for reference):

- **Unit tests** (`RiskScoringServiceTest`, new — none currently exist): one case per acceptance
  criterion, plus boundary/adversarial cases:
  - `rowDebt <= 0` → score 0, no band, regardless of other fields being at max risk.
  - Each ageing bucket in isolation and in combination (e.g. d120 alone vs. d120+d90+d60+d30
    stacked) including the `d120/4000` cap at 12.
  - Missed instalments at 0, just-under-cap, at-cap, and over-cap (verify `min(22, missed*7)`).
  - Every funding status in the lookup table, plus an unrecognized/unknown status (must default
    to 0, not throw).
  - `arrangementStatus == "Defaulted"` (case-insensitive per current code) and null/other values.
  - `lastPaymentDate == null` vs. populated.
  - A maximal-risk debtor to confirm the clamp holds at 99, and a minimal-signal debtor with
    `rowDebt > 0` to confirm the floor holds at 1 (never 0 for a real debt).
  - Band boundaries exactly at 44/45 and 69/70.
  - A debtor with `owedToStudent == true` (in credit) — confirm it is excluded before scoring
    (this is enforced in `RowAssembler`/`DebtMath`, not `RiskScoringService` itself — test at the
    boundary that actually owns the rule).
- **Integration test**: `DebtorController`/`DebtorQueryService` against the H2 test profile,
  seeded with representative fixture rows, asserting the API response's `riskScore`/`band` match
  hand-calculated expected values — proves the full real-data pipeline, not just the pure
  function.
- **E2E**: `docker compose up -d --build`, hit `GET /api/debtors?scope=cases` against the real
  Postgres + Liquibase-seeded data, and manually verify a handful of known seeded debtors' scores
  against hand-calculated expected values.
- **Adversarial cases to include**: zero-balance debtor with otherwise maximal risk signals
  (must still score 0), debtor with an unrecognized funding status string, debtor with all
  optional fields null (`arrangementStatus`, `lastPaymentDate`), debtor exactly on each band
  boundary.

## Rollout Plan

No rollout needed — logic is already deployed as part of the existing backend build. This work
adds verification only; no behavior change is expected unless tests reveal a discrepancy against
§4.1/§4.2, in which case a fix would follow the normal implementation-plan/Gate-1 process before
being merged.

## Metrics & Success Criteria

- Every acceptance-criteria checkbox above has a passing automated test that would fail if the
  rule were violated. **Met** — 22 unit tests + 2 integration tests, 0 failures.
- E2E spot-check against real seeded Postgres data matches hand-calculated expected scores/bands
  with zero discrepancies. **Met** — see Testing Strategy — results.

## Dependencies

- `funding_status_risk_weight` seed data (`002-seed-lookups.xml`) must cover every funding status
  referenced in test fixtures and in `003-seed-debtors.xml`.
- H2 test profile (`ddl-auto: none`, per `backend/README.md`) for the integration test tier.

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Existing implementation has a subtle deviation from §4.1/§4.2 not caught by inspection | Officers see wrong risk ranking, misprioritize cases | Low | Exhaustive unit tests per rule, including boundaries, before closing the ticket |
| Seed data (`003-seed-debtors.xml`) doesn't exercise all rule branches | Gaps in E2E confidence even if unit tests pass | Medium | Cross-check seed data covers at least one debtor per ageing bucket, funding status, and arrangement state; add fixtures if gaps found |
| `arrangementStatus` matching is case-insensitive in code but ticket/spec text doesn't specify case sensitivity | Ambiguous acceptance criterion | Low | Treat current case-insensitive behavior as correct (matches spec's plain-English "Defaulted"); confirm no regression |

## Open Questions

- [ ] Should the integration/E2E tier be run in CI, or is manual E2E verification (per
      `CLAUDE.md`'s testing guidelines) sufficient to close this ticket? Checked all 25 issues in
      the tracker (open and closed) — no issue owns CI/pipeline setup. Closest-adjacent is #21
      (browser support/tech-stack alignment), which doesn't cover it either. Resolution: treat CI
      setup as out of scope for #4; this ticket closes on unit + integration tests passing locally
      plus a documented manual e2e walkthrough. Standing up CI would need its own ticket.

## References

- [Issue #4](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/4)
- `TECHNICAL_SPECIFICATION.md` §4.1 (Score formula), §4.2 (Risk bands)
- `backend/src/main/java/com/adaptit/studentdebt/service/RiskScoringService.java` (existing implementation)
- `backend/src/main/java/com/adaptit/studentdebt/service/RowAssembler.java`,
  `DebtorQueryService.java` (real-data pipeline)
