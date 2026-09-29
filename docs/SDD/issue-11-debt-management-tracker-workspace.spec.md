# Spec: Build the Debt Management Tracker workspace

**Ticket:** [#11](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/11)
**Branch base:** `feat/frontend-backend-scaffold`
**Spec reference:** TECHNICAL_SPECIFICATION.md §6.2 (Debt Management Tracker workspace)

## Overview / Goals

As a debt officer, I want one worklist of every student who needs my attention,
sorted by risk, plus a separate view of refunds and of students paying on cycle, so
I always know where to focus first.

**This feature is already implemented.** `TrackerComponent`
(`frontend/src/app/pages/tracker/tracker.component.ts`/`.html`) and the shared
`CaseRowComponent` (`frontend/src/app/shared/case-row/`) exist today, are explicitly
tagged `(issue #11)` in their doc comments, and satisfy every acceptance criterion on
the ticket (verified against code, see Traceability below). What's missing is test
coverage — neither component has a `.spec.ts` file. This ticket's remaining scope is
**verify + backfill unit tests**, not new feature development.

## Non-Goals

- **No behavioral changes.** The worklist, sorting, and navigation logic are correct
  as shipped; this ticket does not alter `tracker.component.ts`, `case-row.component.ts`,
  or their templates unless a test uncovers an actual defect.
- **No E2E tests.** The change surface is a single Angular module with no new
  backend/API boundary — unit tests at the component level are sufficient, consistent
  with #14's testing strategy.
- **No re-litigating the refund sort order.** The ticket flags it as "unconfirmed,
  default to largest-credit-first" — that default is what's implemented
  (`refundRows()` sorts ascending on signed total, so the most-negative/largest-credit
  row is first). Left as-is.

## User Stories → Acceptance Criteria (traceability)

- [x] Picked-up list renders sorted by risk score descending, each row showing risk
      badge, name/ID/programme, funding pill, signal chips, recommended action +
      owning agent, amount, status, and a link into the case
      — `DebtService.pickedRows()` sorts `riskScore` descending; `CaseRowComponent`
      template renders all listed fields plus a click handler that emits `open`.
- [x] Refund queue renders separately for debtors in credit, largest-credit-first
      — `DebtService.refundRows()`, rendered via the same `CaseRowComponent` under a
      separate "Institution owes the student" heading.
- [x] "Not picked up" table renders read-only: name, funding, funding status, last
      payment, current balance — `tracker.component.html` lines 46-64, plain `<table>`
      with no interactive controls.
- [x] Debt summary KPI block (from #10) is reused — `<app-summary-cards>` at
      `tracker.component.html:15`.
- [x] List updates immediately when the year or funding filter changes — all three
      lists (`pickedCases`, `refundCases`, `payingRows`) are Angular `computed()`
      signals derived from `DebtService.rows()`, which itself reacts to the
      `year`/`funding` signals.
- [x] Clicking a row opens the corresponding case in Case Management (#12) —
      `openCase(id)` calls `debt.setCase(id)` then `router.navigate(['/cases'], { queryParams: { case: id } })`.

## Technical Design → Architecture

No new architecture. Existing components:

- `TrackerComponent` — page-level container, composes `SummaryCardsComponent` and a
  list of `CaseRowComponent`s plus the read-only "not picked up" table.
- `CaseRowComponent` — presentational row, `@Input() case: CaseView`, `@Output() open`.

## Testing Strategy

Add, following the `debt.service.spec.ts` / `cases.component.spec.ts` conventions
from #14:

- **`case-row.component.spec.ts`** (new): given a `CaseView` input, renders name, ID,
  programme, funding pill, signal chips, recommended action, owning agent, amount,
  and status; clicking the row emits `open` with the debtor id; credit rows render
  the "↩"/Credit badge instead of a score/band.
- **`tracker.component.spec.ts`** (new): picked-up list renders in risk-descending
  order; refund queue renders separately, largest-credit-first; "not picked up" table
  renders the correct read-only columns and no interactive controls; all three lists
  react to a `DebtService.setYear()`/`setFunding()` change; row click navigates to
  `/cases` with the correct `case` query param.
- No E2E — see Non-Goals.

## Metrics & Success Criteria

- New spec files pass alongside the full existing suite (`ng test`), no regressions.
- Every acceptance criterion on #11 has at least one asserting test.

## Risks & Mitigations

- **Risk:** writing tests after the fact may encode an existing bug as "correct"
  behavior. **Mitigation:** each new test is checked against the literal AC text
  above, not just against current output, before being accepted.

## Open Questions

None — the ticket's own "unconfirmed" item (refund sort order) already has a stated
default that matches the implementation.
