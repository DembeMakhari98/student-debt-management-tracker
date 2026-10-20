# Officer Decisions — Write-Through to the API Specification

**Status:** Draft — awaiting Gate 1 approval
**Owner:** Oamogetswe-Makgopela
**Created:** 2026-10-20
**Last Updated:** 2026-10-20

## Overview

On the Case Management screen, **Approve**, **Amend terms** and **Decline** currently only change
state in the browser: `DebtService.approveCase/amendCase/declineCase` write to an in-memory map
and an in-memory activity list, so a reload loses the decision and nothing reaches the database
or ITS Integrator. This feature sends each decision to `POST /api/debtors/{debtorKey}/decision`,
refreshes the case from the response, and shows the officer when the save fails — so a decision
survives a reload and is written back (technical spec §3.5, §6.3; BRD "write-back").

Ticket: [#66](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/66)
Epic: [#22](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/22)
Depends on: [#65](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/65)
(merged — `CaseStore`, `DebtorApi`, `toDetailView`).

## Goals

- Approve, Amend and Decline call `POST /api/debtors/{debtorKey}/decision` with
  `APPROVE | AMEND | DECLINE`.
- Amend sends `amendedTerms`; Decline requires, and sends, `reason`.
- The case view (detail panel, list row, badge counts) refreshes from the response.
- A failed save is shown to the officer and leaves the case undecided; the panel stays open so
  nothing typed is lost.
- Unit tests cover the new paths.

## Non-Goals

- **No change to `runAutonomousExecution()`.** The in-browser Level 3/4 auto-resolve keeps its
  local `decide()` path; the server-side equivalent is #58, a separate issue.
- **No change to engagement actions** (SMS / WhatsApp / call) — those are #59 / PR #81.
- **No new endpoint.** `POST /api/debtors/{key}/decision` already exists, returns the refreshed
  `CaseDetailDto`, attributes the decision to the token's user, and is team-scoped (#55).
- **No change to who may decide.** The server enforces the team rule (403 for another team's case).
- **No change to decision button gating** (hard-manual Refund / Registration hold rules).

## User Stories

### As a debt officer, I want my decision saved, so that it survives a reload and is written back to ITS Integrator

**Acceptance Criteria:**
- [ ] Approve calls `POST /api/debtors/{debtorKey}/decision` with `{ "action": "APPROVE" }`
- [ ] Amend calls it with `{ "action": "AMEND", "amendedTerms": <JSON array of {key,value}> }`
- [ ] Decline calls it with `{ "action": "DECLINE", "reason": <non-blank text> }`; the client does
      not send a Decline without a reason
- [ ] `decidedBy` is not sent (the server sets it from the JWT and ignores any client value)
- [ ] On success the case view refreshes from the response: detail panel, the row in the Tracker
      and Case lists, and the "awaiting a decision" counts and tab badge
- [ ] On failure the officer sees a message, the case stays undecided, and the panel stays open
- [ ] While a request is in flight the decision buttons are disabled (no double submit)
- [ ] Unit tests updated

## Technical Design

### Architecture

```
cases.component  approve() / saveAmend() / confirmDecline()
      │
      ▼
CaseStore.decide(debtorKey, action, { amendedTerms?, reason? })
      │  decisionState: idle → saving → idle | error
      ▼
DebtorApi.decide()  ──►  POST {API_BASE}/api/debtors/{key}/decision   (JWT via authInterceptor)
      │
      ▼
CaseDetailDto  ──toDetailView──►  CaseStore.applyDetail(view)
      │                              • detail ← view
      │                              • picked / refunds / paying row with same id ← view.decision
      ▼
pages recompute from store signals (lists, selected case, badge counts)
```

### Data Model

No schema change. Wire shapes:

- Request: `DecisionRequestDto { action, amendedTerms?, reason?, decidedBy? }` — `amendedTerms` is
  a **string**; this feature sends `JSON.stringify([{ key, value }, ...])`, the same shape
  `parseAmendedTerms` already reads back.
- Response: `CaseDetailDto` (already modelled in `debtor-api.ts`), mapped by `toDetailView`.

### API Design

Existing endpoint, no changes:

| Case | Server result | UI behaviour |
|---|---|---|
| Valid decision | `200` + `CaseDetailDto` | Apply response; close panel |
| Missing `amendedTerms` (AMEND) / `reason` (DECLINE) | validation failure (see Risks) | Prevented client-side first; if it still occurs, "The server rejected this decision." |
| Another team's case | `403` | "This case belongs to another team, so you can't decide it." |
| Unknown case | `404` | "This case no longer exists." |
| Token expired | `401` | "Your session has expired. Sign in again." |
| No response / `5xx` | — | "Couldn't save the decision. Check your connection and try again." |

### UI/UX Design

No layout change. In the decision area: buttons disable while saving; a `role="alert"` message
appears on failure; the Amend and Decline panels close only after a successful save.

## Implementation Plan

### Phase 1: API client
- [ ] `DebtorApi.decide(debtorKey, action, { amendedTerms?, reason? })` → `Observable<CaseView>`
      (POST, body as above, response through `toDetailView`).
- [ ] A small `encodeAmendedTerms(Term[])` helper, the inverse of `parseAmendedTerms`.

### Phase 2: Store
- [ ] `CaseStore.decide(...)` with `decisionState` (`idle | saving | error`),
      `decisionErrorStatus` and `decisionErrorMessage` (status → message table above).
- [ ] `applyDetail(view)`: set `detail`, and replace the matching row in `picked` / `refunds` /
      `paying` in place so list order is preserved.
- [ ] Ignore a second `decide` while one is saving.

### Phase 3: Case page
- [ ] `approve()`, `saveAmend()`, `confirmDecline()` call the store; close the panel on success
      only. Decline still requires a trimmed, non-empty reason.
- [ ] Template: disable the three buttons while saving; show the error message.

### Phase 4: Clean-up
- [ ] Remove the now-unused `DebtService.approveCase/amendCase/declineCase`. The private
      `decide()` stays for `runAutonomousExecution()`.
- [ ] `withLocalState()` stays: a server decision still wins over a local one.

### Phase 5: Tests
- [ ] `debtor-api.spec.ts`: request bodies for APPROVE / AMEND / DECLINE, no `decidedBy`, response
      mapped to a `CaseView`, `encodeAmendedTerms` round-trips with `parseAmendedTerms`.
- [ ] `case-store.service.spec.ts`: saving state, success updates detail and list row, failure per
      status (403 / 404 / 401 / network), no double submit, decision survives a list reload.
- [ ] `cases.component.spec.ts`: the three actions hit the API, panel closes on success, stays
      open with a message on failure, Decline blocked without a reason, buttons disabled while
      saving.
- [ ] `debt.service.spec.ts`: drop tests for the removed methods; keep autonomous-execution tests.
- [ ] `testing/mock-api.ts`: answer `POST /api/debtors/{key}/decision` (with a failure switch).

## Testing Strategy

- **Unit:** the specs above, run with `ng test --watch=false --browsers=ChromeHeadless`.
- **Build:** `ng build`.
- **Manual (live backend):** sign in as `nomsa.mahlangu`; approve one case, amend another, decline a
  third; reload and confirm all three persist; confirm the activity log shows the three entries;
  try deciding a Team C case (expect the 403 message). Uses the handover's users and seed data.

## Rollout Plan

Merge to `develop` via PR with reviewers; no flag. Nothing in `main` until `develop` is promoted.

## Metrics & Success Criteria

- A decision is still present after a page reload.
- `activity_log_entry` and `write_back_attempt` gain a row per decision (backend, already built).
- No decision is lost silently: every failure produces a visible message.

## Dependencies

- #65 (merged), #55 (merged — team scope), #13 (decision endpoint), #3 / #59 / #61 (write-back
  pipeline the server already uses).

## Risks & Mitigations

- **The server returns a 500, not a 400, for a missing `amendedTerms` / `reason`.**
  `DecisionService` throws the plain `jakarta.validation.ValidationException`, and there is no
  `@ControllerAdvice` or `@ResponseStatus` to map it. Error bodies also carry no message text
  (`server.error.include-message` is unset). *Mitigation:* the client never sends an invalid
  decision (reason required, terms always present), and shows a status-based message. The
  backend mapping is owned by the backend task's owner and is not changed here — see Open Questions.
- **Decision lost on network failure.** The case stays undecided and the panel stays open, so the
  officer can retry; nothing is stored locally as if it had succeeded.
- **Stale case after a re-score.** The server keys a decision to the recommendation type, so the
  response's `lastDecision` is authoritative; the client applies it as returned.
- **Unverified against the live backend** until the manual pass above is run.

## Open Questions

1. **Fix the backend validation status?** **Decided: no, out of scope for #66.** This ticket is
   frontend-only and touches no backend code. The owner of the backend decision endpoint is to
   map `ValidationException` to a 400 (e.g. `ResponseStatusException(BAD_REQUEST, ...)`, as
   `PortfolioResolver` does). Until then the frontend relies on its own validation and
   status-based messages. Once the backend returns a 400, the existing "The server rejected this
   decision." message applies with no frontend change.
2. **Show server message text?** Not exposed; the frontend uses status-based messages.

## References

- Technical spec §3.5 (`Case` / decision), §5.10 (autonomy gating), §6.3 (Case Management)
- `docs/SDD/issue-14-engagement-channels-panel.spec.md`, `docs/SDD/issue-64-home-summary-live-data.spec.md`
- Handover: `#55, #56, #62` testing notes (team scoping rules)
- Backend: `DebtorController.decide`, `DecisionService`, `DecisionRequestDto`, `DecisionDto`
