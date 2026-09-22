# Debtor Pick-Up Rule Specification

**Status:** Implemented
**Owner:** Ndumiso Mpanza
**Created:** 2026-09-07
**Last Updated:** 2026-09-07 (defect fixed in `DebtMath.pickedUp()`, all acceptance criteria
verified by automated tests + manual e2e against the real docker-compose stack)

## Overview

Debtors with an outstanding balance must be split into "picked up" (shown to a debt officer) and
"paying on cycle" (not actioned), so officers are not shown students with no genuine issue. The
rule already exists (`DebtMath.pickedUp()`) and matches §4.3's formula by inspection. This spec
covers verifying that implementation against the ticket's specific acceptance criteria — including
one gap I found that isn't exercised by current seed data but isn't proven safe either.

## Goals

- Confirm `DebtMath.pickedUp()` matches §4.3 exactly, with test coverage (none currently exists).
- **Fix the mixed-sign defect**: a debtor who is net in credit (`owedToStudent == true`) but has
  one individual ageing bucket still positive can currently be picked up, because `rowDebt()`
  clips negative buckets to zero per-bucket before summing, while `owedToStudent()` sums the raw
  signed total. Confirmed realistic (a current-period credit alongside a genuine prior-term
  arrears balance) — this is a real defect against AC #3, not a theoretical one. See Technical
  Design for the fix.
- Confirm no debtor can appear in both the picked-up list and the refund list simultaneously (no
  double-listing across `DebtorQueryService`'s three worklists) — this is the direct symptom of
  the defect above.
- Confirm the "recomputed every nightly run, not cached" criterion is met by the current
  compute-on-read architecture (no caching layer exists — same as #4).

## Non-Goals

- Risk score/band computation itself — that's #4, already implemented and verified.
- Decision-engine recommendation content — #7.
- Nightly scheduling/extraction — #2 (confirmed out of scope for scoring-adjacent tickets, same
  precedent as #4).
- CI pipeline setup — unowned across the whole issue tracker (confirmed during #4); same
  conclusion applies here.
- Rendering the Tracker/Cases UI tabs that consume `pickedUp` — #11/#12 own that; this ticket only
  covers the backend classification itself.

## User Stories

### As a debt officer, I want the system to flag only the debtors who genuinely need my attention, so that I am not shown students who are paying on cycle with no issue

**Acceptance Criteria:**
- [x] A debtor is picked up only if `rowDebt > 0` AND (missed > 0 OR arrears > 0 OR funding-status
      risk weight >= 8) — `DebtMathTest.missedInstalmentAlonePicksUp` / `.eachArrearsBucketAloneCanPickUp` /
      `.fundingRiskWeightAtCapPicksUp` / `.fundingRiskWeightBelowCapDoesNotPickUp` /
      `.payingOnCycleWhenNoSignalFires`
- [x] Debtors with `rowDebt > 0` who fail this test are classified as "paying on cycle" and
      excluded from the picked-up list — `DebtMathTest.payingOnCycleWhenNoSignalFires`;
      `DebtorQueryServiceTest.everyOutstandingDebtorIsEitherPickedUpOrPayingOnCycle`
- [x] Debtors in credit (owed to student) are excluded from this test entirely and routed to the
      refund path (#7, #11) — fixed via the `owedToStudent(d) ||` guard in `DebtMath.pickedUp()`;
      `DebtMathTest.pureCreditIsNotPickedUp` / `.mixedSignDebtorWithArrearsIsNotPickedUp` /
      `.mixedSignDebtorViaFundingWeightIsNotPickedUp` (the last two are regression tests that
      failed against the pre-fix code); confirmed live against real seeded credit debtors via the
      docker-compose e2e check, and `DebtorQueryServiceTest.noDebtorAppearsInBothPickedAndRefundLists`
      proves no double-listing across the full seeded book
- [x] Pick-up result is recomputed every nightly run, not cached indefinitely — satisfied by
      construction (no caching layer exists anywhere in `DebtorQueryService`/`DebtMath`; every
      request recomputes from current `Debtor` rows), confirmed by the restart-idempotency check
      reused from #4's e2e pass

All four criteria verified by automated tests. Two of the tests
(`mixedSignDebtorWithArrearsIsNotPickedUp`, `mixedSignDebtorViaFundingWeightIsNotPickedUp`) were
run against the pre-fix code first and confirmed to fail, proving the defect was real before the
fix was applied.

## Technical Design

### Architecture

No new components. Existing pipeline, unchanged:

```
DebtorRepository (JPA/Postgres, real data)
  -> DebtorQueryService.pickedRows() / payingRows() / refundRows() / caseRows()
       -> DebtMath.pickedUp(Debtor, fundingRiskWeights)   // pure function, §4.3
  -> RowAssembler.toRow() sets DebtorRowDto.pickedUp
  -> DebtorController (GET /api/debtors?scope=picked|paying|refunds|cases)
```

`DebtMath.pickedUp()` in `backend/src/main/java/com/adaptit/studentdebt/service/DebtMath.java`
already implements the `rowDebt > 0 AND (missed > 0 OR arrears > 0 OR weight >= 8)` formula, but
is missing the explicit credit exclusion AC #3 requires. There is **no caching anywhere** in this
pipeline — every request recomputes from the current `Debtor` rows, so the "not cached
indefinitely" criterion is met by construction, not by any code this ticket needs to add.

**The fix** — smallest change that satisfies AC #3 directly, at the single source of truth so
every consumer (the `pickedRows()` filter, the `payingRows()` filter, and the `pickedUp` field
stamped onto every `DebtorRowDto`) gets the corrected value automatically:

```java
public static boolean pickedUp(Debtor d, Map<String, Integer> fundingRiskWeights) {
    if (owedToStudent(d) || rowDebt(d).signum() <= 0) {
        return false;
    }
    int missed = d.getMissedInstalments() == null ? 0 : d.getMissedInstalments();
    int weight = fundingRiskWeights.getOrDefault(d.getFundingStatus(), 0);
    return missed > 0 || arrears(d).signum() > 0 || weight >= 8;
}
```

Only one line added (`owedToStudent(d) ||`). This also fixes the risk-scoring/banding path
indirectly: `RowAssembler` already guards `band` on `owedToStudent` separately (§4.2, verified in
#4), so this fix does not touch #4's behavior — it only corrects the pick-up classification, which
was #5's gap, not #4's.

### Data Model

No schema changes. Same `debtor` and `funding_status_risk_weight` tables as #4.

### API Design

No new endpoints. `GET /api/debtors?scope=picked` (default), `scope=paying`, `scope=refunds`, and
`scope=cases` already exist and already route through `pickedUp()`.

### UI/UX Design

Out of scope — consumed by #11/#12, not built here.

## Implementation Plan

Approved and executed (Gate 1) — see `specs/issue-5-implementation-plan.md`. One production line
changed in `DebtMath.pickedUp()`.

## Testing Strategy — results

- **Unit tests**: `backend/src/test/java/com/adaptit/studentdebt/service/DebtMathTest.java` — 9
  tests. Run once against the pre-fix code: 2 failed (the mixed-sign regression cases), 7 passed —
  confirming the defect was real, not hypothetical. Run again post-fix: all 9 passed.
- **Integration test**: `backend/src/test/java/com/adaptit/studentdebt/service/DebtorQueryServiceTest.java`
  — 2 tests, both passing: no debtor appears in both `pickedRows()` and `refundRows()`, and every
  debtor with `rowDebt > 0` lands in exactly one of `pickedRows()`/`payingRows()` across the full
  seeded book.
- **Full regression**: `./mvnw test` — 36 tests total (including all of #4's), 0 failures. #4's
  risk scoring/banding is unaffected by this fix.
- **E2E** (`docker compose up -d --build backend`, real Postgres container):
  - `GET /api/debtors?scope=picked` (20 rows), `scope=refunds` (4 rows), `scope=paying` (2 rows)
    against real seeded data — zero overlap between picked and refund debtor keys.
  - The two known real credit debtors (`STU-100355-2026`, `STU-100341-2026`) appear only in
    `refunds`, not in `picked`.
  - #4's two known debtors (`STU-100301-2026` → 96/HIGH, `STU-100234-2026` → 31/WATCH) score
    identically to before the fix — no regression.
  - No mixed-sign debtor exists in current seed data, so this e2e pass proves "no regression to
    existing classifications," not the fix itself — the fix is proven by the `DebtMathTest`
    regression cases above.

Original pre-implementation plan (for reference):

## Testing Strategy

- **Unit tests** (`DebtMathTest`, new — no test file currently exists for `DebtMath`):
  - `rowDebt <= 0` → not picked up, regardless of missed/arrears/weight all being at maximum.
  - `missed > 0`, arrears = 0, weight < 8 → picked up.
  - `missed == 0`, any single arrears bucket (d30/d60/d90/d120) > 0, weight < 8 → picked up.
  - `missed == 0`, arrears = 0, weight >= 8 → picked up; weight boundary exactly at 8 (picked up)
    vs. 7 (not picked up, i.e. "paying on cycle").
  - All three conditions false → "paying on cycle" (not picked up).
  - A pure credit debtor (`owedToStudent == true`, all buckets ⇐ 0 individually) → `rowDebt <= 0`
    → not picked up. Already safe today.
  - **Regression test for the mixed-sign defect**: `rowTotal < 0` (net credit, e.g. a large
    negative current balance) but one older bucket (e.g. `ageing90`) still individually positive,
    so `rowDebt(d) > 0` pre-fix. Assert `pickedUp()` returns `false` post-fix — this test must
    fail against the unfixed code and pass after the one-line `owedToStudent(d) ||` guard is
    added.
- **Integration test**: `DebtorQueryService` against H2 + real Liquibase seed data — assert, across
  every seeded debtor, that no `debtorKey` appears in both `pickedRows()` and `refundRows()`
  simultaneously, and that `pickedRows() ∪ payingRows()` exactly equals every debtor with
  `rowDebt > 0`.
- **E2E**: `docker compose up -d --build`, hit `scope=picked`, `scope=paying`, `scope=refunds`
  against real seeded data, and manually confirm the partition is clean (no debtor missing, none
  duplicated) — reusing the same debtor set already hand-verified in #4's e2e pass.

## Rollout Plan

Unlike #4, this ticket includes a real one-line production fix to `DebtMath.pickedUp()`
(`backend/src/main/java/com/adaptit/studentdebt/service/DebtMath.java`). Low-risk change — it only
tightens an existing filter (a debtor already excluded by `rowDebt <= 0` in the common case is now
also excluded via `owedToStudent`), so it can only ever move a debtor out of the picked-up list,
never wrongly into it. No data migration or rollout sequencing needed beyond the normal PR/merge
process; the risk-scoring path (#4) is unaffected — verified via #4's existing tests still passing.

## Metrics & Success Criteria

- Every acceptance-criteria checkbox has a passing automated test that would fail if violated.
  **Met.**
- No debtor appears in more than one of {picked, refund} across the full seeded book, verified by
  both the integration test and manual e2e. **Met.**
- The mixed-sign regression test fails against the unfixed code and passes after the fix,
  demonstrating the defect is real and resolved (not just untested). **Met.**
- #4's full test suite still passes unchanged after the fix (confirms no regression to risk
  scoring/banding). **Met** — 36/36 tests passing.

## Dependencies

- Same H2 test profile and Liquibase seed data as #4.
- Depends on #4 only in that both consume the same `Debtor` entity and `fundingRiskWeights` map;
  no code dependency on #4's changes (there were none — #4 was verification-only).

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Mixed-sign debtor (net credit, but one individual bucket positive) causes `pickedUp()` to return `true`, contradicting AC #3 | A student in credit could wrongly appear in the officer's picked-up worklist instead of being routed to the refund path | Confirmed realistic (product owner confirmed a current-period credit can coexist with genuine prior-term arrears) | Fixed via `owedToStudent(d) \|\|` guard in `DebtMath.pickedUp()`; regression test locks in the corrected behavior |
| Current seed data doesn't exercise every branch (e.g. weight exactly at the 8 boundary from a "paying on cycle" angle, or the mixed-sign case itself) | Gaps in confidence even with passing tests | Low–Medium | Unit tests use synthetic `Debtor` objects for boundary and mixed-sign cases rather than relying solely on seed data |
| Fixing `pickedUp()` regresses #4's risk scoring/banding | A working, already-verified ticket breaks | Low — `RiskScoringService`/`RowAssembler`'s band logic doesn't call `pickedUp()` | Run #4's full test suite (`RiskScoringServiceTest`, `RowAssemblerTest`, `DebtorControllerTest`) after the fix as a regression check |

## Open Questions

None outstanding — both prior open questions are resolved: the mixed-sign scenario is confirmed
realistic (treated as a real defect, fix specified above), and the fix approach is the direct
one-line guard rather than a more nuanced netting rule, since AC #3 explicitly asks for exclusion
"entirely," not partial netting.

## References

- [Issue #5](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/5)
- `TECHNICAL_SPECIFICATION.md` §4.3 (Pick-up rule)
- `backend/src/main/java/com/adaptit/studentdebt/service/DebtMath.java` (existing implementation)
- `backend/src/main/java/com/adaptit/studentdebt/service/DebtorQueryService.java`,
  `RowAssembler.java` (consumers)
- `specs/issue-4-risk-scoring.md` (prior ticket, same verification-only pattern)
