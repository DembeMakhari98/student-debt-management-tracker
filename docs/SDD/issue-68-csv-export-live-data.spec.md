# CSV Export — Live Data Specification

**Status:** Implemented
**Owner:** Linda50-adaptit
**Created:** 2026-10-18
**Last Updated:** 2026-10-18

## Overview

The "Export CSV" button in the global chrome currently builds its CSV entirely in
the browser, in `DebtService.exportCsv()` — iterating the in-memory mock dataset,
formatting every column, and triggering a client-side download. This feature
switches it to download the backend's own export, `GET /api/debtors/export`, so
the file an officer gets matches the database exactly rather than a client-side
recomputation of a static fixture — the same shift #64 and #67 already made for the
summary cards and Age Analysis.

Ticket: [#68](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/68)
Epic: [#22](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/22)

Builds on the pattern established for [#64](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/64)
and [#67](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/67)
(`docs/SDD/issue-64-home-summary-live-data.spec.md`,
`docs/SDD/issue-67-age-analysis-live-data.spec.md`).

## Goals

- "Export CSV" downloads `GET /api/debtors/export?year=&funding=`, sent with the
  JWT (already automatic via the existing `authInterceptor`).
- The downloaded file's name includes the year and funding filter, exactly as the
  backend names it.
- All browser-side CSV construction in `DebtService.exportCsv()` is removed.

## Non-Goals

- No change to the "Export CSV" button itself, or to `AppComponent.export()` —
  it already just calls `debt.exportCsv()`; that call site is untouched.
- No loading spinner or error banner for the export action. Unlike #64/#67 (which
  render continuously and need a visible stale/unreachable state), this is a
  one-shot, user-initiated download — a failed request simply produces no file,
  logged to the console for debuggability, rather than a persistent UI state.
- Portfolio/officer scoping — out of scope here, same as #64/#67. The frontend
  omits the `portfolio` query parameter and lets the backend resolve the caller's
  default scope (issue #55, already merged to `develop`); per this ticket's own
  notes, "#55 makes the export honour the scope on the server... no change
  needed."
- No new backend endpoint — `GET /api/debtors/export` already exists, implemented
  and merged (`DebtorController`, `CsvExportService`), including `Content-Disposition`
  already in the CORS-exposed header list (`CorsConfig`), specifically for this.

## User Stories

### As a debt officer, I want Export CSV to download the server's export, so that it matches the database exactly

**Acceptance Criteria:**
- [ ] Export CSV downloads `GET /api/debtors/export?year=&funding=` (sent with the
      JWT)
- [ ] File name includes the year and funding filter
- [ ] Browser-side CSV building in `DebtService.exportCsv()` is removed; unit
      tests updated

## Technical Design

### Architecture

```
"Export CSV" button (AppComponent)
      │  export() → debt.exportCsv()
      ▼
DebtService.exportCsv()
      │  HttpClient.get(..., { responseType: 'text', observe: 'response' })
      ▼
GET http://localhost:8080/api/debtors/export?year=&funding=
      │  Authorization: Bearer <jwt> — attached automatically by authInterceptor
      ▼
Spring Boot: DebtorController → CsvExportService → DebtorQueryService → Postgres
      │
      ▼
200 text/csv, Content-Disposition: attachment; filename="student-debt-tracker-2026-gov.csv"
      │
      ▼
DebtService.exportCsv() reads the file name off that header, builds a Blob from
the response body, and triggers the same client-side download (transient <a>
element + URL.createObjectURL) the old code already used — only where the CSV
text comes from changes.
```

No new service is introduced — `exportCsv()` stays on `DebtService` (continuity
with its existing "CSV export — the tracker's own view of the book" section,
issue #17) since, unlike #64's `summary` or #67's ageing data, it isn't a
continuously-rendered view with its own loading/error state to own; it's a single
imperative action triggered by a button click.

### Data Model

No schema changes. Consumes the existing export endpoint's plain-text CSV body,
whose column order already matches the frontend's old output byte-for-byte
(`CsvExportService.HEADER`) — same 20 columns, same "Credit" band override, same
signed balance.

### API Design

Existing endpoint, no changes:

- `GET /api/debtors/export?year={year|all}&funding={self|gov|private|all}` →
  `200 text/csv`, `Content-Disposition: attachment; filename="student-debt-tracker-{year}-{funding}.csv"`.
  Same `YearParam`/`FundingParam` parsing as `/api/summary` and `/api/ageing`.
  The `portfolio` parameter is left unset (see Non-Goals).
- `Content-Disposition` is already in `CorsConfig`'s `exposedHeaders` list, so the
  frontend can read it via `HttpResponse.headers.get(...)` — this was evidently
  added in anticipation of exactly this ticket.

### UI/UX Design

No visual change — the button, its label and its position in the chrome are
unchanged; a click still downloads a `.csv` file with the same name pattern and
column layout a user would already recognize. The only behavioral difference
visible to a user is that the figures in the file are now the backend's, not a
recomputation of whatever's in the browser's mock dataset.

## Implementation Plan

### Phase 1: DebtService
- [ ] Inject `HttpClient` into `DebtService` (constructor).
- [ ] Replace `exportCsv()`'s body: `GET /api/debtors/export` with
      `responseType: 'text'` and `observe: 'response'` so the `Content-Disposition`
      header is readable; build the download `Blob` from `response.body`.
- [ ] Add a small `filenameFromContentDisposition()` helper that parses the file
      name out of the header, falling back to constructing it client-side
      (`student-debt-tracker-{year}-{funding}.csv`, matching the backend's own
      `CsvExportService.fileName()` pattern) only if the header is ever missing.
- [ ] Delete the old row-iteration/column-building/`inPortfolio` filtering logic
      entirely.

### Phase 2: Tests
- [ ] `debt.service.spec.ts`: add `provideHttpClient()`/
      `provideHttpClientTesting()` to every `TestBed.configureTestingModule` call
      (needed the moment `DebtService` depends on `HttpClient` — same
      consequence #64 had). Rework the "CSV export (issue #17)" describe block:
      assertions shift from *re-verifying CSV construction the backend now owns*
      (column order, signed balance, "Credit" band override, portfolio-filtered
      row count) to *verifying the download mechanics* — the request hits
      `/api/debtors/export` with the current year/funding as query params, the
      downloaded `Blob`'s text equals whatever the mocked response body was, the
      anchor's `download` name comes from the mocked `Content-Disposition`
      header (and falls back to the constructed name if that header is absent),
      and `anchor.click()` fires.
  - [ ] Remove `exportCsv()`'s row-count assertion from the "portfolio access
        control (issue #18)" describe block — that behavior no longer exists
        client-side; the backend's own scoping (issue #55) is not this ticket's
        or this test suite's concern.
  - [ ] Update every other spec file that transitively injects `DebtService` and
        doesn't already provide `HttpClient`/`HttpClientTesting` (same set #64
        needed: `tracker.component.spec.ts`, `ageing.component.spec.ts`,
        `cases.component.spec.ts` ×5 blocks, `case-row.component.spec.ts` ×2
        blocks). `app.component.spec.ts` already provides it (via
        `ExtractStatusService`/`AutonomySettingsService`/`AuthService`), so it
        needs no change — and `exportCsv()` is only ever invoked on a button
        click, not eagerly, so no new outstanding-request assertions are needed
        there either.

## Testing Strategy

- **Unit tests** (Karma/Jasmine, `HttpClientTestingModule`) — same approach as
  #64/#67: request construction (URL, year/funding params), response-to-download
  mapping (Blob content, file name sourced from the response header), and the
  fallback file-name construction when the header is missing. Spy on
  `document.createElement`/`URL.createObjectURL`/anchor `click()`, same technique
  the existing suite already uses (carried over from #17).
- **Manual verification** — same local stack as #64/#67; click Export CSV with a
  couple of year/funding combinations selected and confirm the downloaded file's
  name and contents match `curl -OJ http://localhost:8080/api/debtors/export?year=2026`.
- No E2E — file download via `Blob`/`URL.createObjectURL` is exercised at the
  unit level, consistent with #17's own precedent (see
  `docs/SDD/issue-17-export-filtered-view-csv.spec.md`).

## Rollout Plan

Single frontend-only change, no feature flag. No backend deploy needed (endpoint
already shipped). No data migration.

## Metrics & Success Criteria

- All three acceptance criteria on #68 checked off.
- Full `ng test` suite green, including the reworked specs.
- Manual spot-check: Export CSV's downloaded file for 2026/gov matches `curl
  http://localhost:8080/api/debtors/export?year=2026&funding=gov` byte-for-byte.

## Dependencies

- Backend `GET /api/debtors/export` (shipped, issue #17) — no changes needed.
- `CorsConfig`'s `Content-Disposition` exposed header (already present).
- `provideHttpClient(withInterceptors([authInterceptor]))` already registered
  globally in `app.config.ts` — the JWT is attached automatically.

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `Content-Disposition` isn't actually exposed cross-origin at runtime (CORS misconfiguration drift) | Medium | Low | `CorsConfig` already lists it in `exposedHeaders`, confirmed by reading the current config; the frontend also falls back to constructing the file name client-side if the header is missing, so a regression here degrades gracefully rather than breaking the download |
| Adding `HttpClient` to `DebtService` breaks spec files that inject it without a `HttpClient`/`HttpClientTesting` provider | High | High (certain without the fix) | Same fix #64 required: explicit Phase 2 task to update every affected `TestBed.configureTestingModule` call; `ng test` run before considering the ticket done |
| A failed export is invisible to the user (no file, no message) | Low | Low | Acceptable for this ticket per Non-Goals — logged to the console; a visible failure state can be added later if it proves to matter in practice |

## Open Questions

None — all three acceptance criteria are directly actionable against the
existing, already-shipped `/api/debtors/export` endpoint.

## References

- [Issue #68](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/68)
- [Issue #22 — Epic](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/22)
- [Issue #55 — scope the export server-side](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/55) (related, no change needed here; merged to `develop`)
- `docs/SDD/issue-64-home-summary-live-data.spec.md`, `docs/SDD/issue-67-age-analysis-live-data.spec.md` — the sibling tickets this follows
- `docs/SDD/issue-17-export-filtered-view-csv.spec.md` — the original client-side export's spec
- `backend/src/main/java/com/adaptit/studentdebt/web/DebtorController.java`
- `backend/src/main/java/com/adaptit/studentdebt/service/CsvExportService.java`
- `backend/src/main/java/com/adaptit/studentdebt/config/CorsConfig.java`
