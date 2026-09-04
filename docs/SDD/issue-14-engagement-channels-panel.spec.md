# Spec: Build the engagement channels panel on a case

**Ticket:** [#14](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/14)
**Branch base:** `feat/frontend-backend-scaffold`
**Spec reference:** TECHNICAL_SPECIFICATION.md §6.3 (Engagement channels panel), open items 5 and 11

## Overview / Goals

As a debt officer, from the case detail view I can take a quick engagement action —
Send SMS, Send WhatsApp, Log a call, or Hand to Adapt Connect — without leaving the
tracker, and each action I take is recorded on the case's activity log so the trail
stays visible and auditable.

The panel markup already exists in `cases.component.html` (static, unwired). This
ticket wires the buttons to real click behaviour and records each action.

## Non-Goals

- **No real SMS/WhatsApp dispatch.** "Send SMS" and "Send WhatsApp" record that the
  action was taken; they do not call a live gateway. WhatsApp's target provider
  (Cuedesk API — confirmed by the product owner) is noted here as the eventual
  integration point but is **not built in this ticket** — no gateway credentials or
  contract exist yet.
- **No backend/HTTP wiring.** The Angular app has zero `HttpClient` usage anywhere
  today — all case data (including `activity`) is generated client-side in
  `debt.service.ts`. This ticket keeps that pattern: engagement actions are recorded
  into the existing in-memory case model, not persisted via a new REST endpoint or
  to the `activity_log_entry` table. Wiring the frontend to the real Spring Boot
  backend is a separate, cross-cutting effort and explicitly out of scope here.
- **No external ITS Integrator write-back.** That's issue #3. This ticket's activity
  entries only feed the existing "Agent activity on this case" panel.
- **"Hand to Adapt Connect" is not a real integration** in this ticket — see Open
  Questions. It ships visibly present but disabled, with a tooltip, until the
  interface is confirmed.
- **No autonomy-level button gating logic** beyond a documented placeholder — see
  Open Questions. All buttons render for every case regardless of autonomy level or
  recommendation type, same as today, until the gating rule is confirmed.

## User Stories → Acceptance Criteria

- [ ] Send SMS button, when clicked, appends an activity entry (e.g. "SMS sent to
      student", source "Engagement Agent · Officer action") to the current case and
      gives the officer a brief visible confirmation.
- [ ] Send WhatsApp button behaves the same way, entry text notes WhatsApp
      (e.g. "WhatsApp message sent to student"); code comment marks Cuedesk as the
      target gateway for the future real integration.
- [ ] Log a call button opens no dialog (no call-detail capture in this ticket) and
      appends an activity entry (e.g. "Call logged with student").
- [ ] Hand to Adapt Connect button is rendered **disabled**, with a title/tooltip
      explaining the hand-off interface is pending confirmation (issue comment link).
      Clicking it takes no action.
- [ ] Every successful click (SMS/WhatsApp/Log a call) is reflected immediately in
      the "Agent activity on this case" panel, newest entry last (append-only,
      consistent with the existing activity log ordering).
- [ ] Entries persist only for the current browser session (consistent with the
      rest of the app's mock-data lifetime) — no backend persistence in this ticket.
- [ ] Existing case list/detail behaviour (#12) is unaffected.

## Technical Design → Architecture

`DebtService` currently derives `CaseView.activity` fresh, per render, from a pure
function `activityOf(d: Debtor)` — there is no mutable log storage today, so an
engagement click has nothing to append to persistently.

**Change:** add a small signal-backed store to `DebtService`:

```ts
private readonly engagementLog = signal<Map<string, ActivityEntry[]>>(new Map());

logEngagementAction(debtorId: string, entry: ActivityEntry): void {
  const next = new Map(this.engagementLog());
  next.set(debtorId, [...(next.get(debtorId) ?? []), entry]);
  this.engagementLog.set(next);
}
```

`caseOf(d)` appends `this.engagementLog().get(d.id) ?? []` after the entries from
`activityOf(d)`, preserving append-only, newest-last ordering. Because `list` in
`CasesComponent` is a `computed()` over `debt.caseRows()`, and `engagementLog` is a
signal, appending triggers reactive re-render of the activity panel automatically —
no manual refresh needed.

`CasesComponent` gets four click handlers (`sendSms()`, `sendWhatsApp()`,
`logCall()`, `handToAdaptConnect()` — the last a no-op while disabled) that call
`this.debt.logEngagementAction(sel.d.id, {...})` and are bound in the template.

## Technical Design → Data Model

No schema change. Reuses the existing `ActivityEntry` interface (`t`, `m`) —
frontend-only, no backend `ActivityLogEntry` involvement (see Non-Goals).

## API Design

None — no new endpoint in this ticket (see Non-Goals).

## Testing Strategy

- **Unit (`debt.service.spec.ts`):** `logEngagementAction` appends without mutating
  other debtors' logs; order is preserved across multiple calls; `caseOf` reflects
  appended entries after a log call.
- **Unit (`cases.component.spec.ts`):** each button click calls the corresponding
  service method with the currently selected case's debtor id; "Hand to Adapt
  Connect" click is a no-op (button `disabled` attribute is true, service method
  not called).
- **No E2E/integration** — no backend surface is touched.

## Metrics & Success Criteria

- All four buttons render; three are clickable and three are directly testable
  end-to-end at the unit level; the fourth renders disabled.
- No regression to #12's case list/detail rendering or #13's approve/amend/decline
  flow (untouched files, but re-run their existing specs as regression check in
  Stage 5).

## Risks & Mitigations

- **Risk:** entries look like a real audit trail but vanish on page refresh (no
  persistence). **Mitigation:** this matches the existing mock-data lifetime for the
  entire app today — not a new risk introduced by this ticket, but flag it in the PR
  description so it isn't mistaken for real persistence.
- **Risk:** a future engineer wires this to the real backend and reintroduces the
  Non-Goals scope. **Mitigation:** comment above `logEngagementAction` states the
  scope decision and links this spec.

## Open Questions

*(carried from the [clarification comment on #14](https://github.com/DembeMakhari98/student-debt-management-tracker/issues/14#issuecomment-5543737900) — unanswered as of this spec)*

1. **Button gating by autonomy level / recommendation type** — which buttons should
   be enabled/disabled per autonomy level (#8) and recommendation type? Not
   implemented in this ticket; all buttons remain visible/enabled (except Adapt
   Connect) until answered.
2. **Adapt Connect hand-off interface** — endpoint/payload/auth for the real
   integration. Blocks turning the button live; ships disabled.
3. **SMS gateway** — TECHNICAL_SPECIFICATION.md open item 11 asks which existing
   SMS/WhatsApp gateway to integrate with. WhatsApp is now answered (**Cuedesk
   API**, per product owner) but not built here (see Non-Goals). SMS gateway is
   still unconfirmed.
