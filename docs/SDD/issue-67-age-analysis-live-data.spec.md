# Age Analysis — Live Data Specification

**Status:** Implemented
**Owner:** Linda50-adaptit
**Created:** 2026-10-18
**Last Updated:** 2026-10-18

## Overview

The Age Analysis workspace (bar chart, funding × bucket matrix, student detail table,
credit/refund table, stale-credit banner) is currently computed entirely in the
browser in `AgeingComponent`, reading `DebtService.rows()` from the in-memory mock
dataset — including sort order (oldest-money-first for students, oldest-first for
credits) and bucket/band labelling, which duplicate logic the backend already has.
This feature switches `AgeingComponent` to render from the live backend endpoint
`GET /api/ageing`, which does that same filtering, bucketing, sorting and labelling
server-side against Postgres, so Age Analysis shows the institution's real,
server-computed figures instead of a client-side recomputation of a static fixture.

Ticket: [#67](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/67)
Epic: [#22](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/22)

Builds on the same pattern established for [#64](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/64)
(`docs/SDD/issue-64-home-summary-live-data.spec.md`) — fetch on construction, re-fetch
on filter change, loading/error signals, a zeroed/empty fallback on failure.

## Goals

- Age Analysis's four panels (bar chart, funding × bucket matrix, student detail
  table, credit table) and the stale-credit banner render from `GET
  /api/ageing?year=&funding=`.
- Changing the financial year or funding source (from the global chrome filter)
  re-fetches.
- Loading and error states are handled: a visible note when the backend is
  unreachable, rather than a silently blank or stale page.
- Row order (oldest-money-first for students, oldest-first for credits) and
  labelling (oldest-arrear bucket, ageing band) come from the backend as-is — the
  frontend stops re-deriving them.

## Non-Goals

- No visual redesign — the existing card layout, table columns and the
  `AGE_BUCKETS`/`FUND` colour/label constants stay client-side (they're UI theming,
  not business data the backend needs to own).
- Portfolio/officer scoping — out of scope here, same as #64. The frontend omits
  the `portfolio` query parameter entirely and lets the backend resolve the
  caller's default scope (issue #55, already merged to `develop`); per this
  ticket's own ownership notes, "#55 makes `/api/ageing` honour the scope on the
  server... no change needed."
- No change to `DebtService.rows()` or any other DebtService-derived view (Tracker,
  Cases, Home charts) — this ticket touches only `AgeingComponent` and a new,
  dedicated `AgeingApiService`.
- No new backend endpoint or DTO shape — `GET /api/ageing` already exists,
  implemented and merged (`AgeingController`, `AgeingService`, `AgeingResponseDto`).

## User Stories

### As a finance user, I want the Age Analysis page to use the live ageing buckets, so that collections decisions are based on the institution's real position, not stale demo data

**Acceptance Criteria:**
- [ ] Age Analysis uses `GET /api/ageing?year=&funding=`
- [ ] Changing year or funding re-fetches
- [ ] Loading and error states handled; unit tests updated

## Technical Design

### Architecture

```
Age Analysis page
      │
      ▼
AgeingComponent
      │  constructor effect(): watches debt.year()/debt.funding() (global chrome filter)
      ▼
AgeingApiService (new, core/ageing-api.service.ts)
      │  refresh(year, funding) — cancels any still-in-flight previous request
      ▼
HttpClient.get('http://localhost:8080/api/ageing', { params: { year, funding } })
      │
      ▼
Spring Boot: AgeingController → AgeingService → DebtorQueryService → Postgres
```

A new `AgeingApiService` is introduced (rather than folding this into `DebtService`,
as #64 did for `summary`) because ageing data has exactly one consumer
(`AgeingComponent`) and is shaped entirely differently from `DebtService`'s
row-oriented model — there's no second page sharing it the way Home and the
Tracker share `<app-summary-cards>`. It follows the same request-cancellation
pattern as `DebtService.refreshSummary()` from #64.

Unlike #64, the fetch is driven by an Angular `effect()` in `AgeingComponent`'s
constructor (component-scoped, automatically cleaned up on destroy) rather than by
calling `refresh()` from `setYear`/`setFunding` directly — because the year/funding
filter lives in the global chrome (`AppComponent`) and on Home, not on the Ageing
page itself, so the component must react to those shared signals changing while
it's mounted, which is exactly what `effect()` is for. This mirrors
`AppComponent`'s own existing use of `effect()` for sign-in-driven side effects.

### Data Model

No schema changes. Consumes the existing `AgeingResponseDto` response shape
(`backend/.../dto/AgeingResponseDto.java`):

```java
record AgeingResponseDto(
    AgeingDto bucketTotals,                       // current/d30/d60/d90/d120, whole scope
    Map<String, AgeingDto> byFundingSource,        // keyed "SELF"/"GOV"/"PRIVATE"
    List<StudentAgeingRowDto> students,            // pre-sorted oldest-money-first
    List<CreditAgeingRowDto> credits,              // pre-sorted oldest-first (days owing desc)
    BigDecimal staleCreditTotal,
    int staleCreditCount
)
```

`AgeingDto`'s shape (`current`/`d30`/`d60`/`d90`/`d120`) matches the frontend's
existing `Ageing` model field-for-field — reused directly as the TS type for
`bucketTotals`/`byFundingSource` values/`students[].ageing`.

`AgeingComponent`'s local `StudentRow`/`CreditRow` interfaces change their `d` field
from the full mock `Debtor` type to a new minimal `AgeingRowStudent` (`id`, `name`,
`year`, `funding`, and for credits `creditReason`/`creditSince`) — exactly the
subset the template renders, built from the DTO's `studentId`/`name`/`year`/
`fundingSource` fields.

### API Design

Existing endpoint, no changes:

- `GET /api/ageing?year={year|all}&funding={self|gov|private|all}` — same
  `YearParam`/`FundingParam` parsing as `/api/summary`. The `portfolio` parameter
  is left unset (see Non-Goals).
- Response: `AgeingResponseDto` as above, JSON-serialized.

### UI/UX Design

No visual redesign — `ageing.component.html`'s markup, card layout and table
columns are unchanged, since the mapped `StudentRow`/`CreditRow`/`BarRow`/
`MatrixRow` shapes the template already binds to stay the same. Two additions:

- A loading/error affordance, consistent with #64's `summary-cards.component.html`
  pattern: a visible "Backend unreachable" note when `ageingApi.error()` is true,
  with the tables rendering empty (no outstanding balances / no credits) rather
  than stale or broken.
- Row order and the oldest-bucket/ageing-band labels now come straight from the
  API (`oldestBucketLabel`, `ageingBandLabel`) — the frontend looks up the
  matching `AGE_BUCKETS` entry by label to recover its colour for display, but no
  longer computes which bucket is oldest or how a credit is banded.

## Implementation Plan

### Phase 1: Backend-facing data layer
- [ ] Add `frontend/src/app/core/ageing-api.service.ts`: `AgeingApiResponse` (and
      nested `AgeingStudentRow`/`AgeingCreditRow`) types mirroring
      `AgeingResponseDto`; `AgeingApiService` with `data`/`loading`/`error` signals
      and a `refresh(year, funding)` method that cancels any still-in-flight
      previous request before issuing the new one.

### Phase 2: Component wiring
- [ ] `AgeingComponent`: inject `AgeingApiService`; add a constructor `effect()`
      that calls `refresh(debt.year(), debt.funding())` whenever either changes.
- [ ] Replace the `debt.rows()`-derived computeds (`o90Total`, `totalDebt`,
      `creditCount`, `barRows`, `matrixRows`, `studentRows`, the credit-rows
      source) with ones reading `ageingApi.data()`. Downstream computeds that are
      pure derivations of those row arrays (`matrixColTotals`, `matrixGrandTotal`,
      `matrixRowsWithShare`, `studentColTotals`, `studentGrandTotal`,
      `maxCreditDays`, `creditRows`, `creditTotal`, `staleCredits`, `staleAmount`,
      `oldestCredit`, `showYear`) are unchanged — they don't care where the rows
      came from.
- [ ] Add a small `formatCreditSince()` helper (ISO date → `"12 Feb 2026"`, the
      prior mock-data display format) and a `fundKeyOf()` helper
      (`"SELF"` → `'self'`, lower-casing the backend's enum name to the
      frontend's `FundKey`).
- [ ] Add the "Backend unreachable" note to `ageing.component.html`.

### Phase 3: Tests
- [ ] `ageing.component.spec.ts`: add `provideHttpClient()`/
      `provideHttpClientTesting()`. Rework the existing AC-grouped tests to flush
      a crafted `AgeingApiResponse` fixture via `HttpTestingController` rather than
      asserting against the mock dataset — assertions shift from *re-verifying
      business rules now owned by the backend* (sort order, bucket math) to
      *verifying the mapping is faithful* (DTO fields land on the right display
      fields, row order is preserved as given, scaling/percentage math over the
      API's numbers is correct, date/fund-key formatting is correct). Add new
      tests for: request params on construction, re-fetch on year/funding change,
      cancellation of a superseded in-flight request, and the error/empty
      fallback.

## Testing Strategy

- **Unit tests** (Karma/Jasmine, `HttpClientTestingModule`) — same approach as
  #64. Covers request construction, DTO-to-view-model mapping (including the
  `fundingSource` → `FundKey` and ISO-date → display-date conversions), chart
  scaling math, re-fetch on filter change with cancellation of a superseded
  request, and the unreachable-backend fallback.
- **Manual verification** — same local stack as #64 (`docker compose up -d`,
  backend, frontend); confirm Age Analysis's bar chart/matrix/tables match `curl
  http://localhost:8080/api/ageing?year=2026` for a couple of year/funding
  combinations, and that toggling the chrome's filters visibly re-fetches.
- No integration/performance tests — single read-only GET, already covered by the
  backend's own test suite.

## Rollout Plan

Single frontend-only change, no feature flag — same as #64. No backend deploy
needed (endpoint already shipped). No data migration.

## Metrics & Success Criteria

- All three acceptance criteria on #67 checked off.
- Full `ng test` suite green, including the reworked/new specs.
- Manual spot-check: Age Analysis's panels for 2026/all-funding match the
  backend's `/api/ageing?year=2026` response exactly.

## Dependencies

- Backend `GET /api/ageing` (shipped, issue #15) — no changes needed.
- `provideHttpClient()` already registered globally in `app.config.ts`.
- `PortfolioResolver`'s default (`portfolio` omitted → `OWN` scope) — confirmed
  via `backend/.../security/PortfolioResolver.java`, same default #64 already
  relies on.

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `StudentRow`/`CreditRow`'s `d` field shrinking from full `Debtor` to `AgeingRowStudent` breaks a template binding this review missed | Medium | Low | Template only ever reads `d.id`/`d.name`/`d.year`/`d.funding`/`d.creditReason`/`d.creditSince` (confirmed by reading `ageing.component.html` in full); TypeScript compilation fails loudly on anything else |
| Row order silently diverges from the old client-side sort (e.g. a tie-break the backend resolves differently) | Low | Low | The frontend now trusts and preserves the API's order rather than re-deriving it — any divergence is a backend-test concern (`AgeingServiceTest`), not something this ticket re-verifies client-side |
| `effect()`'s first run is scheduled asynchronously relative to component construction, so a test's `httpMock.expectOne()` runs before the request fires | Medium | Medium | `fixture.detectChanges()` flushes pending effects (same pattern already used for `AppComponent`'s own `effect()`); call it before asserting on `httpMock`, verified empirically by running the suite |
| Backend down/unreachable shows a blank or broken page | Low | Medium (dev environments without Postgres running) | `ageingApi.error()` signal + empty-table fallback + inline note, mirroring #64's `summary-cards` pattern |

## Open Questions

None — all three acceptance criteria are directly actionable against the existing,
already-shipped `/api/ageing` endpoint.

## References

- [Issue #67](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/67)
- [Issue #22 — Epic](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/22)
- [Issue #55 — scope `/api/ageing` server-side](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/55) (related, no change needed here; merged to `develop`)
- `docs/SDD/issue-64-home-summary-live-data.spec.md` — the sibling ticket this follows
- `backend/src/main/java/com/adaptit/studentdebt/web/AgeingController.java`
- `backend/src/main/java/com/adaptit/studentdebt/service/AgeingService.java`
- `backend/src/main/java/com/adaptit/studentdebt/dto/AgeingResponseDto.java`
