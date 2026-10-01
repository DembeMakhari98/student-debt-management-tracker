# Student Debt Tracker — Frontend

Angular 19 (standalone components, signals) reproducing the approved prototype
(`student-proactive-debt-management-tracker.html`) with the same layout, styling, colours and
business rules — currently wired to an in-memory mock dataset rather than the live API.

## Running it

```bash
npm install
npm start          # ng serve, http://localhost:4200
```

`npm run build` produces a production bundle in `dist/frontend/`.

## Structure

```
src/app/
  core/
    models.ts          TypeScript shapes (Debtor, CaseView, Recommendation, ...)
    constants.ts        FUND, AGE_BUCKETS, FUND_RISK, POLICY, AGENTS, LEVELS — ported verbatim
    mock-data.ts         The 26-debtor demonstration book (2022–2026) — same numbers as the API's seed data
    debt.service.ts      All state (year/funding/autonomy/case filters) + every derived calculation:
                         risk scoring (issue #4), pick-up rule (#5), signals/evidence (#6),
                         the decision engine (#7), engagement action log (#14), CSV export (#17)
  shared/
    summary-cards/       The 5 KPI cards (issue #10), used by Home and the Tracker
    year-chart/          Debt-by-year stacked bar (SVG)
    donut-chart/         Funding-mix donut (SVG)
    case-row/            One Tracker/refund worklist row (issue #11)
  pages/
    home/                Issue #10
    tracker/             Issue #11
    cases/                Issue #12 — case list + full detail, deep-linkable via /cases?case=<id>
    ageing/               Issue #15 — ageing bars, funding×bucket matrix, per-student and credit tables
  app.component.*        The global chrome — brand bar, tab strip + badges, year/funding filters (issue #16)
```

## Notable implementation detail

Every `<select>` in the chrome renders its `<option>`s with a per-option `[selected]` binding
rather than a `[value]` binding on the `<select>` itself. Angular's plain property binding on a
`<select>` races against `@for`-rendered `<option>` children on first paint (there's no special
buffering outside of `NgModel`/reactive forms), which silently shows the first option instead of
the bound value. Per-option `[selected]` sidesteps that entirely.

## Wiring up the real API later

`DebtService` is the single seam: it currently reads `DEBTORS` from `core/mock-data.ts`. Point its
`rows()`/summary/ageing sources at the Spring Boot API (see `../backend`) instead, and every
component keeps working unchanged — none of them touch the mock data directly.

## Known gaps vs. the full spec

- The Approve / Amend / Decline buttons in Case Management (issue #13) are rendered but not yet
  wired to persist a decision — the backend already exposes `POST /api/debtors/{key}/decision` for
  this (see `../backend/README.md`).
- The engagement-channel buttons (issue #14): Send SMS, Send WhatsApp and Log a call are wired —
  each appends a session-lifetime activity entry (see `docs/SDD/issue-14-engagement-channels-panel.spec.md`
  for the frontend-only scope decision). Hand to Adapt Connect ships disabled pending the hand-off
  interface; button enablement rules per autonomy level are still unconfirmed pending sign-off.
