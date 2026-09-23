# Spec: Export the current filtered view to CSV

**Ticket:** [#17](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/17)
**Branch base:** `feat/frontend-backend-scaffold`
**Spec reference:** TECHNICAL_SPECIFICATION.md §6.5

## Overview / Goals

As a debt officer, I want to export the currently filtered debt view to CSV, so
that I can share or analyse it outside the tracker.

**This feature is already implemented.** `DebtService.exportCsv()`
(`frontend/src/app/core/debt.service.ts:384-410`) exists today, is explicitly
tagged `(issue #17)` in its doc comment, and satisfies every acceptance criterion
on the ticket (verified against code, see Traceability below). It is wired to the
"Export CSV" button in the global chrome (`app.component.html:59`,
`AppComponent.export()`). What's missing is test coverage — no `.spec.ts` file
references `exportCsv`. This ticket's remaining scope is **verify + backfill unit
tests**, not new feature development.

## Non-Goals

- **No behavioral changes.** `exportCsv()`'s column set, ordering, and filename
  pattern are correct as shipped; this ticket does not alter
  `debt.service.ts` or `app.component.ts` unless a test uncovers an actual defect.
- **No E2E tests.** File download via `Blob`/`URL.createObjectURL` is exercised at
  the unit level (spying on `document.createElement`/anchor `click()`), consistent
  with #11's and #14's precedent of no backend boundary crossed.
- **No CSV-library dependency.** The existing implementation builds CSV manually
  (comma-join, double-quoting free-text fields); this ticket does not introduce a
  parsing/formatting library for a 20-column, comma-safe-enough export.

## User Stories → Acceptance Criteria (traceability)

- [x] Export respects the currently selected year and funding filters —
      `exportCsv()` iterates `this.rows()`, the same year/funding-filtered signal
      every other tracker view (`pickedRows`, `refundRows`, `payingRows`) is built
      from (`debt.service.ts:93-96`).
- [x] Column order: Student ID, Name, Programme, Funding, Funding status, Year,
      Missed instalments, Last payment, Current, 30 days, 60 days, 90 days,
      120+ days, Balance, Risk score, Band, Picked up by agent, AI recommendation,
      Status, Policy — `head` array at `debt.service.ts:385-389` matches this
      order exactly, and each data row is built in the same order
      (`debt.service.ts:394-399`).
- [x] Band column shows the literal value "Credit" for debtors in credit, not
      their score band — `this.owedToStudent(d) ? 'Credit' : c.band`
      (`debt.service.ts:397`).
- [x] Balance column is the signed total (can be negative for credits) —
      uses `this.rowTotal(d)` (`debt.service.ts:397`), which sums the (signed)
      ageing buckets and is negative whenever `owedToStudent(d)` is true
      (`debt.service.ts:142-143,154-155`).
- [x] File name pattern: `student-debt-tracker-{year}-{funding}.csv` —
      `a.download = \`student-debt-tracker-${this.year()}-${this.funding()}.csv\``
      (`debt.service.ts:405`).

## Technical Design → Architecture

No new architecture. Existing implementation:

- `DebtService.exportCsv()` — builds a CSV string from `this.rows()` (the shared
  filtered selector) and `this.caseOf(d)` (risk score/band/recommendation), then
  triggers a client-side download via a transient anchor element and
  `URL.createObjectURL`.
- `AppComponent.export()` — thin click handler in the global chrome, delegates to
  `debt.exportCsv()`.

## Testing Strategy

Add, following the `debt.service.spec.ts` conventions from #14/#11:

- **`debt.service.spec.ts`** (extend): `exportCsv()` builds a CSV whose header row
  matches the 20-column order verbatim; a debtor row's `Balance` is the signed
  `rowTotal`; a credit row's `Band` cell is the literal string `"Credit"` (not a
  score band); changing `year`/`funding` before calling `exportCsv()` changes which
  rows are included, matching `rows()`; the generated filename embeds the current
  `year`/`funding`. Spy on `URL.createObjectURL`/`revokeObjectURL` and capture the
  `Blob` passed in to assert on its text content without a real download.
- **`app.component.spec.ts`** (new): clicking the "Export CSV" button calls
  `debt.exportCsv()`.
- No E2E — see Non-Goals.

## Metrics & Success Criteria

- New/extended spec files pass alongside the full existing suite (`ng test`), no
  regressions.
- Every acceptance criterion on #17 has at least one asserting test.

## Risks & Mitigations

- **Risk:** writing tests after the fact may encode an existing bug as "correct"
  behavior. **Mitigation:** each new test is checked against the literal AC text
  above, not just against current output, before being accepted.
- **Risk:** `Blob`/`URL.createObjectURL` are real browser APIs under Karma/Jasmine
  (jsdom is not used) — should behave natively in the existing test environment,
  but if `URL.createObjectURL` is unavailable, spy/stub it rather than skip the
  assertion.

## Open Questions

None — all five acceptance criteria are directly verifiable against the existing
implementation.
