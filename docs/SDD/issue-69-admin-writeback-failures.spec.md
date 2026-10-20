# Admin Write-back Failures Screen Specification

**Status:** Implemented
**Owner:** Linda50-adaptit
**Created:** 2026-10-20
**Last Updated:** 2026-10-20

## Overview

Issue #3 built the write-back port that pushes officer decisions (#13) and reminder-
cadence dispatch (#9) entries to ITS Integrator, with retries and a queryable
admin endpoint (`GET /api/admin/writeback/failures`) for entries that exhaust
every retry — but, per that spec's own Non-Goals, shipped **no UI**: "Failures
are surfaced via a queryable admin endpoint only... not a UI panel."

This ticket builds that panel: a MANAGER/ADMIN-only screen that lists every
write-back failure, so an administrator can see what silently stopped syncing
to ITS Integrator and follow up — the actual AC3 "surfaced" promise finished
end-to-end, not just at the API layer.

Ticket: [#69](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/69)
Epic: [#22](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/22)

Builds on [#3](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/3)'s
already-shipped backend (`docs/SDD/issue-3-activity-log-write-back.spec.md`,
`WriteBackAdminController`, `ActivityLogWriteBackService`, merged via PR #53),
and follows the live-data screen pattern established by
[#64](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/64)/
[#67](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/67)
(`docs/SDD/issue-64-home-summary-live-data.spec.md`,
`docs/SDD/issue-67-age-analysis-live-data.spec.md`) and the role-gating pattern
from [#57](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/57)
(`docs/SDD/issue-57-autonomy-level-write-endpoint.spec.md`).

## Goals

- A new screen, reachable from the global nav, listing every row from
  `GET /api/admin/writeback/failures`.
- Visible — both the nav link and the route itself — only to a signed-in
  MANAGER or ADMIN, mirroring the existing `auth.canSeeAdminJobs()` gate
  already used for the extract-trigger chip and the autonomy dropdown.
- Each row shows: the entry (what failed to write back), the student it
  belongs to, how many attempts were made, the last error, and when that
  last attempt happened.
- Unit tests proving an OFFICER cannot reach the screen (neither via the nav
  link nor by navigating to the route directly) and that a MANAGER/ADMIN can.

## Non-Goals

- **No Retry button.** The AC explicitly defers this to #61 ("manually retry a
  failed ITS Integrator write-back"), which is not yet merged — `POST
  /api/admin/writeback/{attemptId}/retry` doesn't exist yet. Out of scope here;
  picked up once #61 ships.
- **No new backend endpoint or schema change.** `GET /api/admin/writeback/failures`,
  `WriteBackFailureDto`, `WriteBackAttempt` and the MANAGER/ADMIN-only
  `/api/admin/**` Spring Security rule all already exist and are unchanged by
  this ticket.
- **No pagination or filtering.** The failures list is exhausted-retry entries
  only (capped by `ActivityLogWriteBackService.MAX_ATTEMPTS = 3`, retried every
  15 minutes) — expected to be small. Can be added later if volume ever makes
  it necessary.
- **No polling/auto-refresh.** A manual "Refresh" button is enough for an
  admin checking in on the state of write-backs; this isn't a continuously
  monitored dashboard.
- **No year/funding scoping.** Unlike #64/#67, write-back failures aren't
  tied to the global financial-year/funding chrome filter — the list is
  institution-wide, same as the extract-history chip.

## User Stories

### As a system administrator or manager, I want to see which entries failed to write back to ITS Integrator, so that I can follow up

**Acceptance Criteria:**
- [ ] New screen (visible only to MANAGER/ADMIN) lists `GET /api/admin/writeback/failures`
- [ ] Shows entry, student, attempts, last error and last attempt time
- [ ] Retry button deferred until #61 ships (tracked, not built here)
- [ ] Unit tests cover the role-based visibility

## Technical Design

### Architecture

```
Nav link "Write-back failures" (AppComponent, @if auth.canSeeAdminJobs())
      │  routerLink → /writebacks
      ▼
adminGuard (canActivate) — re-checks auth.canSeeAdminJobs(), redirects an
      │  officer to /home (belt-and-braces; the real boundary is the backend's
      │  hasAnyRole("ADMIN","MANAGER") on /api/admin/**, same as #57)
      ▼
WritebacksComponent (lazy-loaded page)
      │  constructor calls WriteBackFailuresService.refresh()
      ▼
WriteBackFailuresService.refresh()
      │  HttpClient.get(...) — Authorization: Bearer <jwt> via authInterceptor
      ▼
GET http://localhost:8080/api/admin/writeback/failures
      │
      ▼
Spring Boot: WriteBackAdminController → ActivityLogWriteBackService.failures()
      │        → enriched from ActivityLogEntryRepository
      ▼
200 [ { activityLogEntryId, debtorKey, text, attemptCount, lastAttemptedAt, lastError } ]
      │
      ▼
WriteBackFailuresService sets its `failures` signal; WritebacksComponent renders
one table row per entry.
```

### Data Model

No schema changes. Consumes the existing `WriteBackFailureDto` record
unchanged:

```java
record WriteBackFailureDto(
    UUID activityLogEntryId, String debtorKey, String text,
    int attemptCount, Instant lastAttemptedAt, String lastError)
```

### API Design

Existing endpoint, no changes:

- `GET /api/admin/writeback/failures` → `200 [WriteBackFailureDto]`. MANAGER/ADMIN
  only, enforced by `SecurityConfig`'s `.requestMatchers("/api/admin/**").hasAnyRole("ADMIN", "MANAGER")`
  — an OFFICER's JWT gets a 403 if this were ever called without the frontend
  guard (defense in depth, not the primary gate).
- `debtorKey`/`text` are nullable (`WriteBackAdminControllerTest` covers the
  case where the source `ActivityLogEntry` was deleted) — rendered as `—` when
  null.

### UI/UX Design

A new tab in the global nav strip, positioned after "Age Analysis", rendered
only `@if (auth.canSeeAdminJobs())` — same conditional already used for the
extract-trigger chip and the autonomy-level `<select>` in the same header.

The page itself follows the single-card-table layout already established by
Age Analysis (#67) and the (not-yet-built) Tracker: a page heading, a stale/
unreachable note when the backend call fails, and one table — Student · Entry
· Attempts · Last error · Last attempted — with an empty state ("No write-back
failures") when the list is empty, and a manual Refresh button.

## Implementation Plan

### Phase 1: Backend
- [ ] None — `GET /api/admin/writeback/failures` already ships on `develop`
      (PR #53). Nothing to change.

### Phase 2: Frontend data layer
- [ ] `core/writeback-failures.service.ts` (new) — `WriteBackFailure` interface
      matching `WriteBackFailureDto` field-for-field; `failures`/`loading`/`error`
      signals; `refresh()` does a plain `GET` (no params, no cancellation —
      mirrors `ExtractStatusService`'s simpler shape, not `AgeingApiService`'s
      filter-driven one, since this page has no filter to re-fetch on).

### Phase 3: Routing & role gating
- [ ] `core/auth/auth.guard.ts` — add `adminGuard`, re-checking
      `auth.canSeeAdminJobs()` and redirecting to `/home` otherwise (same shape
      as `authGuard`/`guestGuard`).
- [ ] `app.routes.ts` — add `{ path: 'writebacks', canActivate: [adminGuard],
      loadComponent: ... }` inside the authenticated children.
- [ ] `app.component.html` — add the nav tab, gated by
      `@if (auth.canSeeAdminJobs())`, after the existing `tabs` `@for` loop
      (that array stays officer-visible-only as-is; this tab is conditional on
      top, same pattern as the extract chip).

### Phase 4: Page component
- [ ] `pages/writebacks/writebacks.component.ts` + `.html` (new) — fetches on
      construction, renders the table, formats `lastAttemptedAt` with the same
      `toLocaleString('en-ZA', { day: '2-digit', month: 'short', year:
      'numeric', hour: '2-digit', minute: '2-digit' })` pattern
      `CasesComponent.decidedAtLabel()` already uses.

### Phase 5: Tests
- [ ] `writeback-failures.service.spec.ts` — request shape, loading/error
      states, field mapping.
- [ ] `writebacks.component.spec.ts` — renders one row per failure, empty
      state, backend-unreachable note, Refresh button re-fetches.
- [ ] `auth.guard.spec.ts` — `adminGuard` lets MANAGER/ADMIN through, bounces
      OFFICER to `/home`.
- [ ] `app.component.spec.ts` — nav link renders only for MANAGER/ADMIN, not
      for OFFICER.

## Testing Strategy

- **Unit tests** (Karma/Jasmine, `HttpClientTestingModule`) — same approach as
  #64/#67/#68: request construction, response-to-signal mapping, loading/error
  states, and the two role-gating surfaces (guard + nav link) called out
  explicitly in the ticket's own AC.
- **Manual verification** — local stack (`docker compose up -d`, backend,
  frontend), sign in as a manager, confirm the nav link and screen appear and
  the table matches `curl -H "Authorization: Bearer <jwt>"
  http://localhost:8080/api/admin/writeback/failures`; sign in as an officer
  and confirm the link is absent and `/writebacks` redirects to `/home`.
- No E2E — consistent with every other admin/live-data screen in this
  codebase so far.

## Rollout Plan

Single frontend-only change, no feature flag, no backend deploy (endpoint
already shipped). No data migration.

## Metrics & Success Criteria

- All four acceptance criteria on #69 checked off (Retry button explicitly
  tracked against #61 rather than claimed done here).
- Full `ng test` suite green, including the new specs.
- Manual spot-check: an officer cannot reach `/writebacks`; a manager sees
  the same failure count as `GET /api/admin/writeback/failures` directly.

## Dependencies

- Backend `GET /api/admin/writeback/failures` (shipped, issue #3/PR #53) — no
  changes needed.
- `auth.canSeeAdminJobs()` (shipped, issue #57) — reused as-is.
- `provideHttpClient(withInterceptors([authInterceptor]))` already registered
  globally — the JWT is attached automatically.
- Blocked on nothing for this ticket's own scope; the Retry button (deferred)
  is blocked on #61.

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Frontend-only role gating is bypassed by a crafted request straight to the API | Low | Low | Not actually a risk — the backend's `hasAnyRole("ADMIN","MANAGER")` on `/api/admin/**` is the real boundary; the frontend guard is UX only, same reasoning as #57 |
| Someone later adds the Retry button against this screen before #61 ships, calling a non-existent endpoint | Low | Low | Explicitly called out in Non-Goals/AC; `POST /api/admin/writeback/{attemptId}/retry` doesn't exist until #61 merges |
| Failure list grows large enough that an unpaginated table becomes unwieldy | Low | Low | Capped by `MAX_ATTEMPTS`-exhausted entries only, expected to stay small; revisit with pagination if it ever doesn't |

## Open Questions

None — directly actionable against the existing, already-shipped
`/api/admin/writeback/failures` endpoint and the existing role-gating
pattern.

## References

- `docs/SDD/issue-3-activity-log-write-back.spec.md` — the backend this
  screen surfaces.
- `docs/SDD/issue-57-autonomy-level-write-endpoint.spec.md` — the
  role-gating pattern (`auth.canSeeAdminJobs()`, belt-and-braces guard
  reasoning) this ticket reuses.
- `docs/SDD/issue-67-age-analysis-live-data.spec.md` — the live-data
  single-card-table page pattern this screen follows.
