# Spec: Build the Age Analysis workspace

**Ticket:** [#15](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/15)
**Branch base:** `feat/frontend-backend-scaffold`
**Spec reference:** TECHNICAL_SPECIFICATION.md §6.4

## Overview / Goals

As a debt officer, I want to see how long the book has been outstanding by bucket,
funding source and student, so that I can understand ageing risk beyond the
picked-up worklist.

**This feature is already implemented.** `AgeingComponent`
(`frontend/src/app/pages/ageing/ageing.component.ts`, wired at route `/ageing`) was
built in the initial scaffold commit, is explicitly tagged `(issue #15)` in its doc
comment, and satisfies every acceptance criterion on the ticket (verified against
code and against the running app — see Traceability below). What was missing is test
coverage — no `.spec.ts` file existed for this component, unlike `cases.component`.
This ticket's remaining scope is **verify + backfill unit tests**, not new feature
development.

## Non-Goals

- **No behavioral changes.** The bar chart, matrix, student table, credit table and
  stale-credit banner logic in `ageing.component.ts`/`.html` are correct as shipped;
  this ticket does not alter them unless a test uncovers an actual defect (none was
  found).
- **No E2E tests.** Consistent with #11/#14/#17 precedent — no backend boundary is
  crossed (the component reads `DebtService.rows()`, the same in-memory mock data
  every other workspace reads from).

## User Stories → Acceptance Criteria (traceability)

- [x] Ageing bar chart renders one bar per bucket (Current→120+), summed across the
      current filter scope — `barRows` computed, one entry per `AGE_BUCKETS`, summing
      `Math.max(0, d.ageing[bucket])` over `debt.rows()` (`ageing.component.ts:53-58`);
      rendered in `ageing.component.html:20-28`.
- [x] Funding source × ageing bucket matrix renders with a totals row and % share
      column — `matrixRows`/`matrixColTotals`/`matrixGrandTotal`/`matrixRowsWithShare`
      (`ageing.component.ts:60-79`); rendered with a totals row and Share column in
      `ageing.component.html:32-64`.
- [x] Student ageing detail table renders every debtor with a positive balance, one
      column per bucket, sorted oldest-money-first, with an "oldest arrear" band pill;
      shows a Year column when scope is "All years" — `studentRows` filters
      `rowDebt(d) > 0` and sorts by `d120` desc, then `d90` desc, then total owed desc
      (`ageing.component.ts:81-96`); `showYear` toggles the Year column
      (`ageing.component.ts:127`); rendered in `ageing.component.html:66-110`.
- [x] Credit ageing table renders every debtor in credit: funding, reason,
      credit-since date, days owing, ageing band (via `daysBand`), and amount owed —
      `creditRowsBase`/`creditRows` (`ageing.component.ts:104-121`); rendered in
      `ageing.component.html:112-170`.
- [x] A stale-credit banner renders when any credit has been owing more than 90 days,
      citing total stale amount, count affected, and the single oldest case —
      `staleCredits`/`staleAmount`/`oldestCredit` (`ageing.component.ts:123-125`),
      filtering `days > 90`; rendered in `ageing.component.html:120-132`.

## Technical Design → Architecture

No new architecture. Existing implementation:

- `AgeingComponent` — a standalone Angular component, all view state derived via
  `computed()` signals from `DebtService.rows()` (the shared year/funding-filtered
  selector every other workspace uses), plus `DebtService` helpers `rowDebt`,
  `owedToStudent`, `oldestBucket`, and `daysBand`.
- No service changes — the component only reads existing `DebtService` API surface.

## Testing Strategy

Added `ageing.component.spec.ts`, following the `cases.component.spec.ts` conventions
from #14:

- Bar chart: one bar per `AGE_BUCKETS` entry in order; bucket amounts sum to
  `totalDebt()`; the largest bucket scales to 100%.
- Matrix: one row per `FUND_KEYS`; column totals equal the grand total; each row's
  share is `rowTotal / grandTotal`, and shares sum to ~100%.
- Student table: only positive-balance debtors included (credit-balance students
  explicitly excluded); sort order verified property-wise (120+ desc, then 90 desc,
  then total owed desc) plus a concrete example against the mock 2026 book; Year
  column visibility toggles with `debt.setYear('all')`.
- Credit table: includes known credit-balance debtors from the mock data with correct
  reason/credit-since/days/amount; each row's band matches `daysBand(days)`; sorted by
  days owing descending.
- Stale-credit banner: only credits >90 days are flagged (verified against a 24-day
  and a 190-day case in the mock data); stale amount and oldest-case selection are
  correct; no stale credits reported for a scope with none.
- Rendered-template checks: the stale banner's text and a bucket-per-row bar render in
  the real DOM via `fixture.detectChanges()`.

## Metrics & Success Criteria

- `ageing.component.spec.ts` passes alongside the full existing suite (`ng test`):
  36/36 (16 pre-existing + 20 new), no regressions.
- Every acceptance criterion on #15 has at least one asserting test.
- Manually verified in a running instance (`ng serve`) for the 2026 book: bar totals,
  matrix totals/shares, student sort order, and the stale-credit banner (Jessica Adams
  flagged at 190 days/R11 800; Mpho Sithole correctly excluded at 24 days) all matched
  hand-calculated expected values from the mock dataset exactly.

## Risks & Mitigations

- **Risk:** writing tests after the fact may encode an existing bug as "correct"
  behavior. **Mitigation:** each test was checked against the literal AC text above
  and against independently hand-calculated totals from the mock dataset, then cross-
  checked visually in the running app, not just against whatever the code already
  output.
- **Risk:** no test file existed before, so a future refactor of `ageing.component.ts`
  had no regression signal. **Mitigation:** this ticket closes that gap going forward.

## Open Questions

None — all five acceptance criteria are directly verifiable against the existing
implementation.
