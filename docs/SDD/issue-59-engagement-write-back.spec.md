# Spec: API — record officer engagement actions (SMS, WhatsApp, call)

**Ticket:** [#59](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/59)
**Branch base:** `develop`
**Blocks:** nothing. **Blocked by:** nothing.

## Overview / Goals

As a debt officer, I want the SMS, WhatsApp and call actions I take on a case to be
saved and written back to ITS Integrator, so that the student's history is complete.

## Non-Goals

- No real SMS/WhatsApp/call dispatch — same as #14's frontend-only precedent, this
  records that the action was taken, it doesn't call a live gateway.
- No change to the frontend. `CasesComponent.logEngagement()` /
  `DebtService.logEngagementAction()` (#14) stay exactly as they are — this ticket is
  the backend counterpart, not a rewire of the existing UI. (A follow-up to point the
  UI at this endpoint instead of its in-memory log is out of scope here.)

## User Stories → Acceptance Criteria

- [ ] `POST /api/debtors/{debtorKey}/engagements` with `{ "channel": "SMS|WHATSAPP|CALL", "note": "..." }`
- [ ] Creates an immutable `activity_log_entry` with the officer identity from the JWT
- [ ] Goes through `ActivityLogWriteBackService` so failures are retried like other entries
- [ ] Returns the updated activity list for the case; unknown channel → 400

## Technical Design → Architecture

- `EngagementChannel` enum: `SMS`, `WHATSAPP`, `CALL`.
- `EngagementRequestDto(@NotNull String channel, String note)` — `channel` missing/blank
  is a standard `@Valid` 400 (`MethodArgumentNotValidException`, Spring Boot's default
  mapping); `channel` present but not one of the three values is a new
  `web.BadRequestException` (`@ResponseStatus(HttpStatus.BAD_REQUEST)`, mirroring
  `NotFoundException`'s pattern) — the two 400 causes are different failure shapes, both
  land on 400 regardless.
- `EngagementService.record(debtorKey, request, officerDisplayName)`:
  1. `debtorRepository.findById(debtorKey)` → `NotFoundException` if absent (same
     precedent as `DecisionService.decide()`).
  2. Parse `channel`; unknown value → `BadRequestException`.
  3. Build `text` per channel, matching the existing frontend wording exactly so the
     audit trail reads the same regardless of which layer wrote it:
     "SMS sent to student" / "WhatsApp message sent to student" / "Call logged with
     student" — append ` — {note}` when `note` is non-blank (same suffix style
     `DecisionService` uses for a DECLINE reason).
  4. `source` = `"Engagement Agent · " + officerDisplayName` (parallels
     `DecisionService`'s `"Officer decision · " + decidedBy"`).
  5. Save the `ActivityLogEntry`, call `writeBackService.recordAndAttempt(entry)` —
     identical wiring to #13/#9's producers.
  6. Return `caseService.detailFor(debtorKey).activity()` — the same `List<ActivityEntryDto>`
     already on `CaseDetailDto`, so the client re-renders exactly like it does after a
     decision.
- `DebtorController` gets `POST /{debtorKey}/engagements`, taking `Authentication` and
  attributing identity via the existing `CurrentUser.displayName(authentication)` helper
  — never from the request body, same principle `decide()` already follows.
- **Added during rebuild against current `develop` (2026-10-19):** #55's portfolio access
  control landed on `develop` after this ticket was first built, adding
  `debtorQueryService.requireAccess(debtorKey, portfolioResolver.caseAccess(authentication))`
  to `detail()` and `decide()`. Engaging with a case is the same kind of officer-level
  action, so `engage()` gets the identical check — an officer outside the case's team (or
  portfolio) gets `403`, not a silent write to a case they can't otherwise see.

## Technical Design → Data Model

No schema change — reuses `ActivityLogEntry` and `ActivityLogWriteBackService` from #3
as-is.

## API Design

`POST /api/debtors/{debtorKey}/engagements`
Request: `{ "channel": "SMS" | "WHATSAPP" | "CALL", "note": "optional free text" }`
Response: `200 OK`, body = `List<ActivityEntryDto>` (the case's updated activity list).
Errors: `400` (missing/unknown channel), `404` (unknown debtor).

## Testing Strategy

- **Unit (`EngagementServiceTest`, mirroring `DecisionServiceTest`):** each channel
  produces the expected text/source; a note is appended when present and omitted when
  blank; an unknown channel throws `BadRequestException`; an unknown debtor throws
  `NotFoundException`; `writeBackService.recordAndAttempt` is called with the saved
  entry.
- **MockMvc:** a caller with portfolio access → 200 with the updated activity list
  containing the new entry; missing channel → 400; unknown channel value → 400; unknown
  debtor key → 404; unauthenticated → 401; an officer outside the case's team/portfolio
  → 403 (same debtor key `PortfolioScopeTest` already uses for this exact scenario).

## Risks & Mitigations

- **Risk:** officer identity resting on `CurrentUser.displayName` could fall back to
  the raw JWT subject/username if the `name` claim is absent. **Mitigation:** this is
  the same helper and the same fallback `decide()` already relies on — not a new risk
  introduced here, and every seeded `app_user` row has a `displayName`.

## Open Questions

None.
