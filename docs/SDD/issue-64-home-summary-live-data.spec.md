# Home Summary Cards — Live Data Specification

**Status:** Implemented
**Owner:** Linda50-adaptit
**Created:** 2026-10-15
**Last Updated:** 2026-10-15

## Overview

The Home page's 5 KPI summary cards (Registered students, Total debt owed to
institution, Owed to students, At risk 90+ days, Average balance per debtor) are
currently computed in the browser in `DebtService.summary` from the in-memory mock
dataset (`DEBTORS`). This feature switches that single computed signal to fetch its
numbers from the live backend endpoint `GET /api/summary`, which reads the same
Postgres tables (`debtor`, `registered_count`) the nightly extract populates — so the
Home dashboard (and the Tracker page, which reuses the same `<app-summary-cards>`
component) shows the institution's real, server-side figures instead of a static
fixture.

Ticket: [#64](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/64)
Epic: [#22](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/22)

## Goals

- Summary cards' five figures (registered students, total debt, owed to students,
  at risk 90+ days, average balance) come from `GET /api/summary?year=&funding=`.
- Changing the financial year or funding source filter on Home re-fetches.
- Figures match the backend exactly for the seeded data (e.g. 2026: 4,812
  registered, R 165,400 total debt).
- A backend-unreachable state degrades visibly rather than silently showing stale
  or wrong numbers.

## Non-Goals

- The Home page's two charts (per-year stacked debt bar chart, funding-mix donut)
  are **not** switched to a live endpoint in this ticket, despite the issue title's
  "and charts" — the acceptance criteria only name the summary cards and
  `/api/summary`, and no backend endpoint currently returns the multi-year,
  per-funding breakdown those charts need. They continue reading the local mock
  dataset (`DebtService.rows()`), unchanged.
- Portfolio/officer scoping of `/api/summary` — tracked separately in #55 ("no
  change needed" per this ticket's own ownership notes). The Home summary stays
  institution-wide, as it is today.
- The Tracker, Cases, and Age Analysis pages' own data sources — out of scope
  (Age Analysis is #67, CSV export is #68).
- No new API endpoint or backend change — `GET /api/summary` already exists,
  implemented, and tested (`SummaryController`, `SummaryService`).

## User Stories

### As a debt officer, I want the Home page figures to come from the live database, so that I'm not making decisions off stale, hardcoded demo numbers

**Acceptance Criteria:**
- [ ] Summary cards (registered students, total debt, owed to students, at risk,
      average balance) use `GET /api/summary?year=&funding=`
- [ ] Changing financial year or funding source re-fetches
- [ ] Figures match the backend for the seeded data (e.g. 2026: 4,812 registered,
      R 165,400 total debt)
- [ ] Unit tests updated

## Technical Design

### Architecture

```
Home / Tracker page
      │
      ▼
<app-summary-cards>  (SummaryCardsComponent, unchanged template)
      │  reads debt.summary() / debt.summaryLoading() / debt.summaryError()
      ▼
DebtService
      │  year() / funding() signals  →  toObservable()  →  switchMap
      ▼
HttpClient.get('http://localhost:8080/api/summary', { params: { year, funding } })
      │
      ▼
Spring Boot: SummaryController → SummaryService → DebtorRepository / RegisteredCountRepository
      │
      ▼
Postgres (debtor, registered_count tables, seeded by Liquibase)
```

No new services are introduced. `DebtService` already owns the `year`/`funding`
filter signals and the `summary` computed signal consumed by
`SummaryCardsComponent` — this change swaps that one computed's data source,
following the pattern already proven by `ExtractStatusService` (issue #2) for
calling the Spring Boot API from Angular.

Implementation note: rather than wiring the fetch reactively through
`toObservable`/`toSignal` (RxJS interop), `setYear`/`setFunding` explicitly call a
private `refreshSummary()` method, which unsubscribes any still-in-flight previous
request before issuing the new one — the same cancel-on-change guarantee
`switchMap` gives, but synchronous and straightforward to assert against in
`HttpTestingController`-based tests without `fakeAsync`.

### Data Model

No schema changes. Consumes the existing `SummaryDto` response shape
(`backend/.../dto/SummaryDto.java`):

```java
record SummaryDto(
    long registeredStudents,
    BigDecimal totalDebt,
    int debtorCount,
    BigDecimal totalCredit,
    int creditCount,
    BigDecimal atRisk90Plus,
    double atRisk90PlusPct,
    BigDecimal averageBalance
)
```

The frontend's `DebtSummary` model (`frontend/src/app/core/models.ts`) changes from
carrying full `debtors: Debtor[]` / `credits: Debtor[]` arrays (a mock-data artifact,
used only for `.length`) to carrying `debtorCount: number` / `creditCount: number`
directly, matching the API response one-to-one.

### API Design

Existing endpoint, no changes:

- `GET /api/summary?year={year|all}&funding={self|gov|private|all}`
- `year`/`funding` omitted or `"all"` (case-insensitive) → whole book, matching the
  frontend's `'all'` sentinel (`YearParam`/`FundingParam` already handle this).
- Response: `SummaryDto` as above, serialized as JSON (BigDecimal → plain number).

### UI/UX Design

No visual redesign — `summary-cards.component.html`'s markup and card layout are
unchanged. Two additions to `DebtService`'s public surface for the component to
react to:

- `summaryLoading: Signal<boolean>` — true while a request is in flight.
- `summaryError: Signal<boolean>` — true when the most recent request failed
  (backend unreachable or non-2xx). `summary()` falls back to an all-zero
  `DebtSummary` in this state rather than throwing, so the cards render "R 0" /
  "0" instead of blank — paired with a small inline note (reusing the "Backend
  unreachable" wording/placement already established by `ExtractStatusService` +
  `AppComponent`'s extract-status chip) so the zeros are legible as a failure
  state, not a real empty book.

## Implementation Plan

### Phase 1: Frontend data layer
- [ ] Update `DebtSummary` (`core/models.ts`) to `debtorCount`/`creditCount` in
      place of `debtors`/`credits` arrays.
- [ ] In `DebtService`: inject `HttpClient`; replace the mock-data-derived
      `summary` computed with one backed by `GET /api/summary`, fetched via a
      `refreshSummary()` method called from the constructor and from
      `setYear`/`setFunding`, which cancels any still-in-flight previous request.
      Add `summaryLoading`/`summaryError` signals alongside it.
- [ ] Map `SummaryDto`'s field names to `DebtSummary`'s.

### Phase 2: Component wiring
- [ ] Update `SummaryCardsComponent` to read `debtorCount`/`creditCount` instead of
      `.debtors.length`/`.credits.length`.
- [ ] Add a minimal "backend unreachable" note to `summary-cards.component.html`,
      shown when `debt.summaryError()` is true.

### Phase 3: Tests
- [ ] `debt.service.spec.ts`: add `provideHttpClient()`/`provideHttpClientTesting()`
      to every `TestBed.configureTestingModule` call (needed the moment
      `DebtService` depends on `HttpClient`); new tests asserting the request URL
      and `year`/`funding` query params for a few filter combinations (a specific
      year + funding, `'all'`/`'all'`), that a flushed response maps correctly into
      `summary()`, and that a failed/erroring request sets `summaryError()` and
      falls back to a zeroed summary rather than throwing.
  - [ ] Update the 5 other spec files that transitively inject `DebtService`
      (`tracker.component.spec.ts`, `ageing.component.spec.ts`,
      `cases.component.spec.ts` ×5 blocks, `app.component.spec.ts` already does
      this) to provide `HttpClient`/`HttpClientTesting` too, or their
      `TestBed.inject(DebtService)` calls start failing with a missing-provider
      error.
- [ ] New `summary-cards.component.spec.ts`: renders the 5 cards from a flushed
      mock `/api/summary` response with known values (sanity-checking against the
      issue's own worked example — 4,812 registered, R 165,400 total debt for
      2026) and that it reflects a changed year/funding selection with a new
      request.

## Testing Strategy

- **Unit tests** (Karma/Jasmine, `HttpClientTestingModule`) — the only practical
  layer here; no existing E2E harness in this repo to extend. Covers: query
  parameter correctness, response-to-view-model mapping, re-fetch on filter
  change, race safety (a second filter change in flight supersedes the first via
  `switchMap`), and the unreachable-backend fallback.
- **Manual verification** — `docker compose up -d` (Postgres) + `cd backend &&
  ./mvnw spring-boot:run`, then `cd frontend && npm start`; confirm Home's cards
  match `curl http://localhost:8080/api/summary?year=2026` for a couple of
  year/funding combinations, and that toggling the filters visibly re-fetches
  (network tab).
- No integration/performance tests — single read-only GET already covered by the
  backend's own test suite.

## Rollout Plan

Single frontend-only change, no feature flag — merges directly to `develop` once
reviewed, same as the rest of this epic's completed tickets. No backend deploy
needed (endpoint already shipped). No data migration.

## Metrics & Success Criteria

- All four acceptance criteria on #64 checked off.
- Full `ng test` suite green, including the new/updated specs.
- Manual spot-check: Home's 5 cards for 2026/all-funding match the backend's
  `/api/summary?year=2026` response exactly.

## Dependencies

- Backend `GET /api/summary` (shipped, issue #10) — no changes needed.
- `provideHttpClient()` already registered globally in `app.config.ts`.

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `DebtSummary` shape change (`debtors[]`/`credits[]` → counts) breaks a consumer this review missed | Medium | Low | `summary()` has exactly one consumer (`SummaryCardsComponent`), confirmed by repo-wide search; TypeScript compilation will fail loudly on any other, unmigrated consumer |
| Adding `HttpClient` to `DebtService` breaks the 5 other spec files that inject it without a `HttpClient`/`HttpClientTesting` provider | High | High (certain without the fix) | Explicit Phase 3 task to update every affected `TestBed.configureTestingModule` call; `ng test` run before considering the ticket done |
| Rapid filter changes race two in-flight requests, showing a stale response | Low | Low | `refreshSummary()` unsubscribes the previous request's subscription before issuing the new one, cancelling it at the RxJS level |
| Backend down/unreachable shows a blank or broken card | Low | Medium (dev environments without Postgres running) | `summaryError` signal + zeroed fallback + inline note, mirroring the existing `ExtractStatusService`/chrome pattern |

## Open Questions

None — all four acceptance criteria are directly actionable against the existing,
already-shipped `/api/summary` endpoint.

## References

- [Issue #64](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/64)
- [Issue #22 — Epic](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/22)
- [Issue #55 — scope `/api/summary` server-side](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/55) (related, no change needed here)
- `backend/src/main/java/com/adaptit/studentdebt/web/SummaryController.java`
- `backend/src/main/java/com/adaptit/studentdebt/service/SummaryService.java`
- `frontend/src/app/core/extract-status.service.ts` — precedent for calling the backend from Angular
